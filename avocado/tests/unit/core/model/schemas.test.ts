import { describe, expect, it } from 'vitest';
import { CaseFileSchema, FactSchema, StanceSchema, newCaseFile } from '../../../../src/core/model';

describe('§9.4 core model schemas (G3, G10)', () => {
  it('a new case file has no stance and no default role (G10)', () => {
    const c = newCaseFile({ id: 'c1', docId: 'd1', lang: 'fr' });
    expect(c.stance).toBeUndefined();
    expect(c.objective).toBeUndefined();
    expect(c.session.stance).toBeUndefined();
    expect(CaseFileSchema.parse(c)).toEqual(c);
  });

  it('a stance must be explicitly confirmed', () => {
    const base = {
      role: 'claimant',
      clientName: 'A',
      opposingParties: ['B'],
      confirmedAt: '2026-10-16T10:00:00.000Z',
    };
    expect(StanceSchema.safeParse({ ...base, confirmedByUser: true }).success).toBe(true);
    expect(StanceSchema.safeParse({ ...base, confirmedByUser: false }).success).toBe(false);
    expect(StanceSchema.safeParse(base).success).toBe(false);
  });

  it('a stance with role "other" needs a description', () => {
    const s = {
      role: 'other',
      clientName: 'A',
      opposingParties: [],
      confirmedByUser: true,
      confirmedAt: '2026-10-16T10:00:00.000Z',
    };
    expect(StanceSchema.safeParse(s).success).toBe(false);
    expect(StanceSchema.safeParse({ ...s, roleDescription: 'Mis en cause' }).success).toBe(true);
  });

  it('every fact carries a status, a position and a favorability (G3)', () => {
    const fact = {
      id: 'F-1',
      text: 'La vente a eu lieu.',
      parties: [],
      sourceRefs: [],
      status: 'provided',
      position: 'admitted',
      favorability: 'neutral',
    };
    expect(FactSchema.safeParse(fact).success).toBe(true);
    expect(FactSchema.safeParse({ ...fact, status: 'certain' }).success).toBe(false);
    const { position: _position, ...noPosition } = fact;
    expect(FactSchema.safeParse(noPosition).success).toBe(false);
  });
});
