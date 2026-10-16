import type { ZodType } from 'zod';
import { LlmSchemaError } from './errors';

/** Strips an optional ```json fence; JSON-schema enforcement is only prompt-level on reasoning models. */
function unfence(content: string): string {
  const m = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m?.[1] ?? content.trim();
}

/** Parses model content and validates it with zod; throws LlmSchemaError with readable issues. */
export function parseStructured<T>(content: string, schema: ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(unfence(content));
  } catch {
    throw new LlmSchemaError(['the answer is not valid JSON']);
  }
  return validateStructured(raw, schema);
}

export function validateStructured<T>(raw: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  throw new LlmSchemaError(
    result.error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`),
  );
}
