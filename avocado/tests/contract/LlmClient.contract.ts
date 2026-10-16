import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LlmSchemaError } from '../../src/llm/errors';
import type { LlmClient } from '../../src/ports';

/**
 * §9.1 Liskov: any LlmClient must return schema-valid values or throw LlmSchemaError.
 * `make` receives what the "model" should answer for the next call.
 */
export function llmClientContract(name: string, make: (answers: unknown[]) => LlmClient, opts: { live?: boolean } = {}) {
  describe(`LlmClient contract: ${name}`, () => {
    const Schema = z.object({ language: z.enum(['fr', 'en']), count: z.number().int() });

    it('returns a value that satisfies the requested schema', async () => {
      const llm = make([{ language: 'fr', count: 3 }]);
      const out = await llm.generate({
        task: 'detectMissingInfo',
        system: 'Answer ONLY with JSON matching the schema: {"language":"fr"|"en","count":integer}.',
        user: 'Language of "Bonjour tout le monde" and the number of words in it.',
        schema: Schema,
      });
      expect(Schema.safeParse(out).success).toBe(true);
    }, 300_000);

    if (!opts.live) {
      it('throws LlmSchemaError when the answer does not match the schema', async () => {
        const llm = make([{ language: 'de' }]);
        await expect(
          llm.generate({ task: 'detectMissingInfo', system: 's', user: 'u', schema: Schema }),
        ).rejects.toBeInstanceOf(LlmSchemaError);
      });
    }
  });
}
