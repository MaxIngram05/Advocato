import type { ZodType } from 'zod';
import type { Alert, CaseFile, Fact, LlmCallLog } from '../core/model';
import type { Clock, IdGenerator, LlmClient, LlmTask } from '../ports';
import { LlmOutputInvalidError, LlmSchemaError } from './errors';
import { downgradeUngrounded, validateGrounding, type GroundingIssue } from './GroundingValidator';
import { validateStructured } from './parseStructured';
import type { AllowedSource, PromptBuilder } from './PromptBuilder';

export interface GroundedRequest<T> {
  task: LlmTask;
  caseFile: CaseFile;
  schema: ZodType<T>;
  allowedSources: AllowedSource[];
  /** Facts shown to the model (CASE FACTS). Grounding accepts any fact of the case. */
  facts: Fact[];
  payload: unknown;
  /** Smaller payload for retries after truncation/timeouts (§10.2). */
  compactPayload?: unknown;
  preferLongContext?: boolean;
  /** Pseudo-exhibits the answer may cite besides the case exhibits (e.g. "chat"). */
  extraExhibitIds?: string[];
  file?: { name: string; mime: string; base64: string };
}

export interface GroundedResult<T> {
  value: T;
  alerts: Alert[];
  downgraded: GroundingIssue[];
  calls: LlmCallLog[];
}

const describeIssue = (i: GroundingIssue) =>
  i.kind === 'citation'
    ? `${i.path}: "${i.id}" is not in ALLOWED_SOURCES`
    : `${i.path}: ${i.kind} "${i.id}" does not exist in this case`;

/**
 * §14.3 validation loop: zod parse → grounding check → one retry with the errors →
 * second failure: downgrade ungrounded items and raise a warning alert.
 */
export class GroundedGenerator {
  constructor(
    private readonly llm: LlmClient,
    private readonly prompts: PromptBuilder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run<T>(req: GroundedRequest<T>): Promise<GroundedResult<T>> {
    const ctx = {
      allowedSourceIds: req.allowedSources.map((s) => s.id),
      factIds: req.caseFile.facts.map((f) => f.id),
      exhibitIds: [...req.caseFile.exhibits.map((e) => e.id), ...(req.extraExhibitIds ?? [])],
    };
    const calls: LlmCallLog[] = [];
    const alerts: Alert[] = [];
    let errors: string[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = this.prompts.build({ ...req, validationErrors: errors });
      const compact = req.compactPayload === undefined ? undefined : this.prompts.build({ ...req, payload: req.compactPayload, validationErrors: errors });
      let value: T;
      try {
        value = await this.llm.generate({
          task: req.task,
          system: prompt.system,
          user: prompt.user,
          schema: req.schema,
          allowedSourceIds: ctx.allowedSourceIds,
          ...(compact ? { compactUser: compact.user } : {}),
          ...(req.preferLongContext ? { preferLongContext: true } : {}),
          ...(req.file ? { file: req.file } : {}),
        });
      } catch (e) {
        this.log(req.task, calls, alerts);
        if (!(e instanceof LlmSchemaError)) throw e;
        errors = e.issues;
        continue;
      }
      this.log(req.task, calls, alerts);
      const issues = validateGrounding(value, ctx);
      if (issues.length === 0) return { value, alerts, downgraded: [], calls };
      if (attempt === 1) {
        const { value: downgraded, removed } = downgradeUngrounded(value, issues);
        alerts.push({
          id: this.ids.next('AL'),
          severity: 'warning',
          message: `Unverified references were removed from the ${req.task} answer: ${removed.map((r) => r.id).join(', ')}.`,
        });
        return { value: validateStructured(downgraded, req.schema), alerts, downgraded: removed, calls };
      }
      errors = issues.map(describeIssue);
    }
    throw new LlmOutputInvalidError(req.task, errors);
  }

  private log(task: LlmTask, calls: LlmCallLog[], alerts: Alert[]) {
    const meta = this.llm.lastCall?.();
    if (!meta) return;
    calls.push({ task, at: this.clock.now().toISOString(), ...meta });
    if (meta.fallback) {
      alerts.push({
        id: this.ids.next('AL'),
        severity: 'info',
        message: `The ${task} request was served by fallback capacity (region: ${meta.inferenceRegion ?? 'unknown'}${meta.fallbackReason ? `, reason: ${meta.fallbackReason}` : ''}).`,
      });
    }
  }
}
