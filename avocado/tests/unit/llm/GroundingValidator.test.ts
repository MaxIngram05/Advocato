import { describe, expect, it } from 'vitest';
import { downgradeUngrounded, validateGrounding } from '../../../src/llm/GroundingValidator';

const ctx = { allowedSourceIds: ['S-1', 'S-2'], factIds: ['F-1', 'F-2'] };

describe('§14.3 GroundingValidator (G1, G8)', () => {
  it('accepts output that only cites allowed sources and known facts', () => {
    const out = { rows: [{ citationIds: ['S-1'], factIds: ['F-1'] }], note: { citationId: 'S-2', factId: 'F-2' } };
    expect(validateGrounding(out, ctx)).toEqual([]);
  });

  it('reports every citation id that is not in ALLOWED_SOURCES, with its path', () => {
    const out = { rows: [{ citationIds: ['S-1', 'X-9'], factIds: [] }, { citationIds: ['Y-1'] }] };
    expect(validateGrounding(out, ctx)).toEqual([
      { path: 'rows[0].citationIds[1]', kind: 'citation', id: 'X-9' },
      { path: 'rows[1].citationIds[0]', kind: 'citation', id: 'Y-1' },
    ]);
  });

  it('reports unknown fact ids, including singular fields', () => {
    const out = { items: [{ factIds: ['F-1', 'F-404'] }], best: { factId: 'F-500' } };
    expect(validateGrounding(out, ctx)).toEqual([
      { path: 'items[0].factIds[1]', kind: 'fact', id: 'F-404' },
      { path: 'best.factId', kind: 'fact', id: 'F-500' },
    ]);
  });

  it('downgrades: strips unknown ids, marks facts as hypothesis, and lists what was removed', () => {
    const out = {
      facts: [{ id: 'F-9', status: 'proven', factIds: ['F-404'], citationIds: ['S-1', 'X-9'] }],
      rows: [{ citationIds: ['X-9'], factIds: ['F-1'] }],
    };
    const issues = validateGrounding(out, ctx);
    const { value, removed } = downgradeUngrounded(out, issues);
    expect(value).toEqual({
      facts: [{ id: 'F-9', status: 'hypothesis', factIds: [], citationIds: ['S-1'] }],
      rows: [{ citationIds: [], factIds: ['F-1'] }],
    });
    expect(removed).toEqual(issues);
    expect(validateGrounding(value, ctx)).toEqual([]);
  });

  it('downgrade does not mutate its input', () => {
    const out = { rows: [{ citationIds: ['X-9'] }] };
    const copy = JSON.stringify(out);
    downgradeUngrounded(out, validateGrounding(out, ctx));
    expect(JSON.stringify(out)).toBe(copy);
  });

  it('clears an unknown singular reference', () => {
    const out = { best: { factId: 'F-500', text: 't' } };
    expect(downgradeUngrounded(out, validateGrounding(out, ctx)).value).toEqual({ best: { text: 't' } });
  });
});
