export interface ErrorDecision {
  retry: boolean;
  waitMs?: number;
  fallbackModel?: string;
  reduceContext?: boolean;
}

export interface ErrorInput {
  status: number;
  code: string | undefined;
  /** Retries already made for this request (0 on the first failure). */
  attempt: number;
  retryAfterSeconds?: number;
  longContextModel: string;
}

const NO: ErrorDecision = { retry: false };
const WAIT_CODES = new Set(['rate_limit_exceeded', 'quota_exceeded', 'capacity_exceeded']);

/** §10.2 Augure error policy: pure, table-tested. */
export function augureErrorPolicy({ status, code, attempt, retryAfterSeconds, longContextModel }: ErrorInput): ErrorDecision {
  const within = (max: number, decision: ErrorDecision) => (attempt < max ? decision : NO);
  const retryAfter = { retry: true, waitMs: (retryAfterSeconds ?? 1) * 1000 };

  if (status === 400 && code === 'context_length_exceeded') return within(1, { retry: true, fallbackModel: longContextModel });
  if (status === 429 && code === 'concurrency_limit_exceeded') return within(1, { retry: true, waitMs: 2000 });
  if (status === 429 && (code === undefined || WAIT_CODES.has(code))) return within(2, retryAfter);
  if (status === 503 && code === 'residency_unavailable') return within(2, retryAfter);
  if (status === 500) return within(1, { retry: true });
  if (status === 502) return within(2, { retry: true, waitMs: 1000 * 2 ** attempt });
  if (status === 504) return within(1, { retry: true, reduceContext: true });
  return NO;
}
