import { describe, expect, it } from 'vitest';
import { applyFactRules, flipFavorability, sortTimeline, verifySourceRefs } from '../../../../src/core/facts/factRules';
import { FactPool } from '../../../../src/core/facts/FactPool';
import { initialSession } from '../../../../src/core/model';
import { fact } from '../../../fixtures/cases';

describe('US-04 fact status rules (G3)', () => {
  it('forces a fact without sources to hypothesis', () => {
    expect(applyFactRules(fact('F-1', { sourceRefs: [], status: 'proven' })).status).toBe('hypothesis');
    expect(applyFactRules(fact('F-1', { sourceRefs: [], status: 'provided' })).status).toBe('hypothesis');
  });

  it('keeps missing and hypothesis facts without sources as they are', () => {
    expect(applyFactRules(fact('F-1', { sourceRefs: [], status: 'missing' })).status).toBe('missing');
    expect(applyFactRules(fact('F-1', { sourceRefs: [], status: 'hypothesis' })).status).toBe('hypothesis');
  });

  it('keeps sourced facts unchanged', () => {
    const f = fact('F-1', { status: 'proven' });
    expect(applyFactRules(f)).toEqual(f);
  });
});

describe('US-04 source verification (excerpts must exist in the exhibit)', () => {
  const texts = new Map([
    ['P-1', [{ locator: 'p. 1', text: 'Le contrat est signé le 9 octobre 2025.\nClause de non-garantie.' }]],
  ]);

  it('keeps a reference whose excerpt appears in the exhibit (whitespace-insensitive)', () => {
    const refs = [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'signé le 9   octobre 2025. Clause' }];
    expect(verifySourceRefs(refs, texts)).toEqual({ kept: refs, dropped: [] });
  });

  it('finds the excerpt on another page and corrects the locator', () => {
    const multi = new Map([
      ['P-1', [{ locator: 'p. 1', text: 'Intro' }, { locator: 'p. 2', text: 'Le toit coule.' }]],
    ]);
    expect(verifySourceRefs([{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'toit coule' }], multi).kept).toEqual([
      { exhibitId: 'P-1', locator: 'p. 2', excerpt: 'toit coule' },
    ]);
  });

  it('drops a reference to an unknown exhibit or an excerpt that is not in the source', () => {
    const refs = [
      { exhibitId: 'P-9', locator: 'p. 1', excerpt: 'x' },
      { exhibitId: 'P-1', locator: 'p. 1', excerpt: 'texte inventé' },
    ];
    expect(verifySourceRefs(refs, texts)).toEqual({ kept: [], dropped: refs });
  });

  it('is accent- and case-sensitive but tolerant to typographic quotes', () => {
    const t = new Map([['P-1', [{ locator: 'para. 1', text: 'L’acheteur a écrit « avis ».' }]]]);
    expect(verifySourceRefs([{ exhibitId: 'P-1', locator: 'para. 1', excerpt: "L'acheteur a écrit" }], t).kept).toHaveLength(1);
  });
});

describe('US-04 timeline', () => {
  it('sorts dated facts chronologically, undated facts last, ties by id', () => {
    const facts = [
      fact('F-3'),
      fact('F-2', { date: '2025-10-09' }),
      fact('F-10', { date: '2024-01-01' }),
      fact('F-1'),
      fact('F-4', { date: '2025-10-09' }),
    ];
    expect(sortTimeline(facts).map((f) => f.id)).toEqual(['F-10', 'F-2', 'F-4', 'F-1', 'F-3']);
  });

  it('handles partial dates (year or year-month)', () => {
    const facts = [fact('F-1', { date: '2025-03' }), fact('F-2', { date: '2025' }), fact('F-3', { date: '2025-03-02' })];
    expect(sortTimeline(facts).map((f) => f.id)).toEqual(['F-2', 'F-1', 'F-3']);
  });
});

describe('§7 favorability follows the stance', () => {
  it('flips favorable/unfavorable when switching between claimant and defendant', () => {
    const facts = [
      fact('F-1', { favorability: 'favorable' }),
      fact('F-2', { favorability: 'unfavorable' }),
      fact('F-3', { favorability: 'neutral' }),
    ];
    expect(flipFavorability(facts).map((f) => f.favorability)).toEqual(['unfavorable', 'favorable', 'neutral']);
  });
});

describe('US-05 FactPool', () => {
  const facts = [fact('F-1', { date: '2025-02-01' }), fact('F-2', { date: '2025-01-01' }), fact('F-3')];

  it('lists the selectable facts in timeline order', () => {
    const session = { ...initialSession(), factPool: ['F-1', 'F-2', 'F-3'] };
    expect(new FactPool(facts, session).selectable().map((f) => f.id)).toEqual(['F-2', 'F-1', 'F-3']);
  });

  it('excludes facts already used by an earlier argument', () => {
    const session = { ...initialSession(), factPool: ['F-3'] };
    expect(new FactPool(facts, session).selectable().map((f) => f.id)).toEqual(['F-3']);
  });

  it('reports the current selection', () => {
    const session = { ...initialSession(), factPool: ['F-1', 'F-2'], selectedFactIds: ['F-2'] };
    expect(new FactPool(facts, session).selected().map((f) => f.id)).toEqual(['F-2']);
  });
});
