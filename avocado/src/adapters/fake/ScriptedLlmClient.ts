import { validateStructured } from '../../llm/parseStructured';
import type { LlmCallMeta, LlmClient, LlmRequest, LlmTask } from '../../ports';

/** A scripted answer: raw JSON the "model" returns, or an Error it throws. */
export type ScriptedAnswer = unknown;

/**
 * Fake LLM for tests and the dev harness (§14.4). Answers are consumed per task, in
 * order, and validated with the request schema exactly like the real adapter.
 */
export class ScriptedLlmClient implements LlmClient {
  readonly requests: LlmRequest<unknown>[] = [];
  private readonly script: Partial<Record<LlmTask, ScriptedAnswer[]>>;

  constructor(
    script: Partial<Record<LlmTask, ScriptedAnswer[]>>,
    private readonly meta?: LlmCallMeta,
  ) {
    this.script = Object.fromEntries(Object.entries(script).map(([k, v]) => [k, [...(v ?? [])]]));
  }

  /** Adds answers for a task (e.g. per-scenario fixtures). */
  enqueue(task: LlmTask, ...answers: ScriptedAnswer[]): void {
    this.script[task] = [...(this.script[task] ?? []), ...answers];
  }

  remaining(task: LlmTask): number {
    return this.script[task]?.length ?? 0;
  }

  async generate<T>(req: LlmRequest<T>): Promise<T> {
    this.requests.push(req as LlmRequest<unknown>);
    const queue = this.script[req.task];
    if (!queue || queue.length === 0) throw new Error(`ScriptedLlmClient: no answer scripted for ${req.task}`);
    const answer = queue.shift();
    if (answer instanceof Error) throw answer;
    return validateStructured(JSON.parse(JSON.stringify(answer)) as unknown, req.schema);
  }

  lastCall(): LlmCallMeta | undefined {
    return this.meta ? { ...this.meta } : undefined;
  }
}
