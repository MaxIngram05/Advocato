import { describe, expect, it } from 'vitest';
import { ScriptedLlmClient } from '../../../src/adapters/fake/ScriptedLlmClient';
import { LlmOutputInvalidError } from '../../../src/llm/errors';
import { GroundedGenerator } from '../../../src/llm/GroundedGenerator';
import { PromptBuilder } from '../../../src/llm/PromptBuilder';
import { ExtractFactsOutputSchema } from '../../../src/llm/schemas';
import { analysisCase, buyerStance } from '../../fixtures/cases';

const ids = { next: (p: string) => `${p}-x` };
const clock = { now: () => new Date('2026-10-16T10:00:00.000Z') };

const labeled = {
  text: 'La vente a été conclue.',
  parties: [],
  sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'vente' }],
  status: 'proven',
  position: 'admitted',
  favorability: 'neutral',
};

describe('G3 fact status labels are enforced on LLM output', () => {
  it('rejects facts without a status or position, retries once, then fails', async () => {
    const { status: _s, position: _p, ...unlabeled } = labeled;
    const llm = new ScriptedLlmClient({ extractFacts: [{ facts: [unlabeled], uncertainties: [] }, { facts: [unlabeled], uncertainties: [] }] });
    await expect(
      new GroundedGenerator(llm, new PromptBuilder(), ids, clock).run({
        task: 'extractFacts',
        caseFile: analysisCase(buyerStance),
        schema: ExtractFactsOutputSchema,
        allowedSources: [],
        facts: [],
        payload: {},
      }),
    ).rejects.toBeInstanceOf(LlmOutputInvalidError);
  });

  it('rejects labels outside the allowed vocabulary', () => {
    expect(ExtractFactsOutputSchema.safeParse({ facts: [{ ...labeled, status: 'certain' }], uncertainties: [] }).success).toBe(false);
    expect(ExtractFactsOutputSchema.safeParse({ facts: [labeled], uncertainties: [] }).success).toBe(true);
  });
});
