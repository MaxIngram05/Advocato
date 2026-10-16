import type { CaseFile, StanceSuggestion } from '../core/model';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import { SuggestStanceOutputSchema } from '../llm/schemas';

/**
 * US-02 / G10: proposes a stance with its evidence. The result is only ever shown to the
 * lawyer; nothing here (or anywhere) applies it without an explicit confirmation.
 */
export class SuggestStance {
  constructor(private readonly llm: GroundedGenerator) {}

  async execute(caseFile: CaseFile): Promise<StanceSuggestion | null> {
    if (caseFile.stance) return null;
    const messages = caseFile.messages
      .filter((m) => m.role === 'user')
      .map((m, i) => ({ locator: `message ${i + 1}`, text: m.text }));
    const result = await this.llm.run({
      task: 'suggestStance',
      caseFile,
      schema: SuggestStanceOutputSchema,
      allowedSources: [],
      facts: [],
      payload: { conversation: { exhibitId: 'chat', segments: messages }, parties: caseFile.parties },
      extraExhibitIds: ['chat'],
    });
    return result.value.suggestion;
  }
}
