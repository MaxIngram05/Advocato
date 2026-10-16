import { describe, expect, it } from 'vitest';
import { readSelectionText, type SelectionLike } from '../../../src/adapters/gas/GasDocumentWriter';

const element = (text: string, partial?: [number, number]) => ({
  getElement: () => ({ asText: () => ({ getText: () => text }), editAsText: () => ({ getText: () => text }) }),
  isPartial: () => partial !== undefined,
  getStartOffset: () => partial?.[0] ?? -1,
  getEndOffsetInclusive: () => partial?.[1] ?? -1,
});

describe('US-03 reading the document selection', () => {
  it('returns an empty string when nothing is selected', () => {
    expect(readSelectionText(null)).toBe('');
  });

  it('joins whole and partial selected elements as paragraphs', () => {
    const selection: SelectionLike = {
      getRangeElements: () => [element('Premier paragraphe.'), element('Deuxième paragraphe complet.', [0, 7])],
    };
    expect(readSelectionText(selection)).toBe('Premier paragraphe.\n\nDeuxième');
  });
});
