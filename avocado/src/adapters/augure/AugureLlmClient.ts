import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { LlmHttpError, LlmSchemaError, LlmTruncatedError } from '../../llm/errors';
import { parseStructured } from '../../llm/parseStructured';
import type { LlmCallMeta, LlmClient, LlmRequest, LlmTask } from '../../ports';
import type { HttpClient, HttpResponse } from '../http/HttpClient';
import { augureErrorPolicy } from './AugureErrorPolicy';

export interface AugureConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  longContextModel: string;
}

type Effort = 'low' | 'medium' | 'high';

/** §10.2 reasoning effort per task (tasks the spec leaves open are logged in DECISIONS.md, D13). */
export const REASONING_EFFORT: Record<LlmTask, Effort> = {
  suggestNextPrompts: 'low',
  proofread: 'low',
  detectMissingInfo: 'low',
  suggestStance: 'low',
  transcribePdf: 'low',
  extractFacts: 'medium',
  buildMatrixRows: 'medium',
  assessDamages: 'medium',
  draftDocument: 'medium',
  proposeArguments: 'high',
  generateCounterArguments: 'high',
  generateRebuttals: 'high',
  justifyRemedy: 'high',
  analyseUnfavorableEvidence: 'high',
  findWeaknesses: 'high',
  buildAnalysis: 'medium',
  converse: 'low',
};

interface AugureCompletion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: Record<string, number>;
  _augure?: { request_id?: string; inference_region?: string; fallback?: boolean; fallback_reason?: string };
}

function jsonSchemaOf(schema: ZodType<unknown>): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = zodToJsonSchema(schema, { $refStrategy: 'none' }) as Record<string, unknown>;
  return rest;
}

function errorOf(res: HttpResponse): { code: string | undefined; message: string } {
  try {
    const parsed = JSON.parse(res.body) as { error?: { code?: string; message?: string } };
    return { code: parsed.error?.code, message: parsed.error?.message ?? `HTTP ${res.status}` };
  } catch {
    return { code: undefined, message: `HTTP ${res.status}` };
  }
}

/**
 * §10.2 Augure (OpenAI-compatible) chat completions, non-streaming. Nothing
 * Augure-specific leaves this adapter.
 */
export class AugureLlmClient implements LlmClient {
  private last: LlmCallMeta | undefined;

  constructor(
    private readonly deps: {
      http: HttpClient;
      config: AugureConfig;
      sleep: (ms: number) => Promise<void>;
    },
  ) {}

  lastCall(): LlmCallMeta | undefined {
    return this.last;
  }

  /** Configured models that GET /models does not list (a retired id would fail every call). */
  async missingModels(): Promise<string[]> {
    const { config, http } = this.deps;
    const res = await http.request({ method: 'GET', url: `${config.baseUrl}/models`, headers: this.headers() });
    if (res.status !== 200) {
      const { code, message } = errorOf(res);
      throw new LlmHttpError(res.status, code, message);
    }
    const ids = new Set(((JSON.parse(res.body) as { data?: { id: string }[] }).data ?? []).map((m) => m.id));
    return [config.model, config.longContextModel].filter((m) => !ids.has(m));
  }

  async generate<T>(req: LlmRequest<T>): Promise<T> {
    const { config } = this.deps;
    let model = req.preferLongContext ? config.longContextModel : config.model;
    let user = req.user;
    let truncations = 0;
    const retries = new Map<string, number>();

    for (;;) {
      const res = await this.post(model, req, user);
      if (res.status === 200) {
        const data = JSON.parse(res.body) as AugureCompletion;
        this.last = this.meta(model, data, res);
        const choice = data.choices?.[0];
        if (choice?.finish_reason === 'length') {
          truncations++;
          if (truncations === 1 && req.compactUser !== undefined && user !== req.compactUser) {
            user = req.compactUser;
            continue;
          }
          if (model !== config.longContextModel) {
            model = config.longContextModel;
            continue;
          }
          throw new LlmTruncatedError(req.task);
        }
        const content = choice?.message?.content;
        if (typeof content !== 'string' || content.trim() === '') throw new LlmSchemaError(['the answer is empty']);
        return parseStructured(content, req.schema);
      }

      const { code, message } = errorOf(res);
      const key = `${res.status}:${code ?? ''}`;
      const attempt = retries.get(key) ?? 0;
      const retryAfter = Number(res.headers['retry-after']);
      const decision = augureErrorPolicy({
        status: res.status,
        code,
        attempt,
        longContextModel: config.longContextModel,
        ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
      });
      if (!decision.retry) throw new LlmHttpError(res.status, code, message);
      retries.set(key, attempt + 1);
      if (decision.waitMs) await this.deps.sleep(decision.waitMs);
      if (decision.fallbackModel) model = decision.fallbackModel;
      if (decision.reduceContext && req.compactUser !== undefined) user = req.compactUser;
    }
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.deps.config.apiKey}`, 'Content-Type': 'application/json' };
  }

  private post<T>(model: string, req: LlmRequest<T>, user: string): Promise<HttpResponse> {
    const userContent = req.file
      ? [
          { type: 'text', text: user },
          { type: 'file', file: { filename: req.file.name, file_data: `data:${req.file.mime};base64,${req.file.base64}` } },
        ]
      : user;
    const body = {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: { name: req.task, schema: jsonSchemaOf(req.schema) } },
      reasoning_effort: REASONING_EFFORT[req.task],
      temperature: 0.2,
    };
    return this.deps.http.request({
      method: 'POST',
      url: `${this.deps.config.baseUrl}/chat/completions`,
      headers: this.headers(),
      body: JSON.stringify(body),
    });
  }

  private meta(model: string, data: AugureCompletion, res: HttpResponse): LlmCallMeta {
    const a = data._augure ?? {};
    const requestId = a.request_id ?? res.headers['x-request-id'];
    return {
      model,
      ...(requestId ? { requestId } : {}),
      ...(a.inference_region ? { inferenceRegion: a.inference_region } : {}),
      ...(a.fallback ? { fallback: true } : {}),
      ...(a.fallback_reason ? { fallbackReason: a.fallback_reason } : {}),
      ...(data.usage ? { usage: data.usage } : {}),
    };
  }
}
