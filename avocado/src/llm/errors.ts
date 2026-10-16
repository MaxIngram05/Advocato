/** The model answered, but not with JSON matching the requested schema. */
export class LlmSchemaError extends Error {
  constructor(readonly issues: string[]) {
    super(`LLM output does not match the schema: ${issues.join('; ')}`);
    this.name = 'LlmSchemaError';
  }
}

/** Still invalid after the one allowed retry (§14.3). */
export class LlmOutputInvalidError extends Error {
  constructor(
    readonly task: string,
    readonly issues: string[],
  ) {
    super(`The ${task} answer was still invalid after a retry: ${issues.join('; ')}`);
    this.name = 'LlmOutputInvalidError';
  }
}

/** finish_reason "length" on every attempt (§10.2). */
export class LlmTruncatedError extends Error {
  constructor(readonly task: string) {
    super(`The ${task} answer was truncated (finish_reason "length").`);
    this.name = 'LlmTruncatedError';
  }
}

/** Non-retryable (or retries exhausted) HTTP error from the provider. */
export class LlmHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'LlmHttpError';
  }
}
