import { describe, expect, it } from 'vitest';
import { estimateTokens, packContext } from '../../../src/llm/ContextPacker';
import { fact } from '../../fixtures/cases';

const row = (id: string) => ({
  id,
  elementId: 'E2_DEFECT',
  factIds: ['F-1'],
  evidence: [],
  analysis: 'a'.repeat(200),
  argument: 'b',
  conclusionSought: 'c',
  citationIds: [],
  confidence: 'arguable' as const,
});
const excerpt = (n: number) => ({ exhibitId: 'P-1', locator: `p. ${n}`, text: 'x'.repeat(400) });

describe('§14.3 ContextPacker', () => {
  it('estimates tokens at ~4 characters per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens({ a: 1 })).toBe(estimateTokens('{"a":1}'));
  });

  it('keeps everything when it fits', () => {
    const out = packContext({ facts: [fact('F-1')], rows: [row('R-1')], excerpts: [excerpt(1)] }, 10_000);
    expect(out.facts).toHaveLength(1);
    expect(out.rows).toHaveLength(1);
    expect(out.excerpts).toHaveLength(1);
    expect(out.truncated).toBe(false);
    expect(out.overBudget).toBe(false);
  });

  it('prioritizes selected facts, then matrix rows, then exhibit excerpts', () => {
    const facts = [fact('F-1'), fact('F-2')];
    const budget = estimateTokens(facts[0]) + estimateTokens(facts[1]) + estimateTokens(row('R-1')) + 5;
    const out = packContext({ facts, rows: [row('R-1'), row('R-2')], excerpts: [excerpt(1)] }, budget);
    expect(out.facts.map((f) => f.id)).toEqual(['F-1', 'F-2']);
    expect(out.rows.map((r) => r.id)).toEqual(['R-1']);
    expect(out.excerpts).toEqual([]);
    expect(out.truncated).toBe(true);
    expect(out.overBudget).toBe(false);
  });

  it('flags overBudget when even the selected facts do not fit (→ long-context model)', () => {
    const out = packContext({ facts: [fact('F-1'), fact('F-2')], rows: [], excerpts: [] }, 1);
    expect(out.overBudget).toBe(true);
    expect(out.facts).toHaveLength(2);
  });

  it('skips a large excerpt but still fits later smaller ones', () => {
    const small = { exhibitId: 'P-2', locator: 'p. 1', text: 'petit' };
    const out = packContext({ facts: [], rows: [], excerpts: [excerpt(1), small] }, estimateTokens(small) + 1);
    expect(out.excerpts).toEqual([small]);
    expect(out.truncated).toBe(true);
  });

  it('is deterministic', () => {
    const input = { facts: [fact('F-1')], rows: [row('R-1')], excerpts: [excerpt(1), excerpt(2)] };
    expect(packContext(input, 300)).toEqual(packContext(input, 300));
  });
});
