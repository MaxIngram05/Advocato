import { describe, expect, it } from 'vitest';
import {
  checkIntake,
  nextIntakeQuestions,
  objectiveOptions,
  type IntakeDraft,
} from '../../../../src/core/intake/IntakeCompletenessChecker';
import type { Stance } from '../../../../src/core/model';

const stance: Stance = {
  role: 'claimant',
  clientName: 'Client A',
  opposingParties: ['Party B'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

const complete: IntakeDraft = {
  court: 'Cour du Québec, chambre civile',
  areaOfLaw: 'civil',
  stance,
  objective: 'reduction',
  dateOfFacts: '2025-10-09',
  parties: [
    { name: 'Client A', role: 'buyer' },
    { name: 'Party B', role: 'seller' },
  ],
  documentCount: 1,
};

describe('US-02 IntakeCompletenessChecker', () => {
  it('accepts a complete intake', () => {
    expect(checkIntake(complete)).toEqual({ complete: true, missing: [] });
  });

  it('accepts optional fields when present', () => {
    expect(
      checkIntake({ ...complete, procedureStage: 'Mise en demeure envoyée', opposingArguments: ['Vice apparent'] }),
    ).toEqual({ complete: true, missing: [] });
  });

  it('lists every missing required field in a stable order', () => {
    expect(checkIntake({}).missing).toEqual([
      'court',
      'areaOfLaw',
      'stance',
      'objective',
      'dateOfFacts',
      'parties',
      'documents',
    ]);
  });

  it.each([
    ['court', { court: '  ' }],
    ['areaOfLaw', { areaOfLaw: 'astrology' }],
    ['dateOfFacts', { dateOfFacts: '2025-13-45' }],
    ['dateOfFacts', { dateOfFacts: 'last week' }],
    ['parties', { parties: [] }],
    ['parties', { parties: [{ name: '', role: 'buyer' }] }],
    ['documents', { documentCount: 0 }],
    ['objective', { objective: 'dismissal' }],
  ] as const)('flags %s when invalid', (field, patch) => {
    expect(checkIntake({ ...complete, ...patch } as IntakeDraft).missing).toEqual([field]);
  });

  it('the intake stage does not require documents yet (D7); analysis does', () => {
    const noDocs = { ...complete, documentCount: 0 };
    expect(checkIntake(noDocs, { stage: 'intake' })).toEqual({ complete: true, missing: [] });
    expect(checkIntake(noDocs).missing).toEqual(['documents']);
  });

  it('treats an unconfirmed stance as missing (G10)', () => {
    const forged = { ...stance, confirmedByUser: false } as unknown as Stance;
    expect(checkIntake({ ...complete, stance: forged }).missing).toContain('stance');
  });

  it('requires a role description when the role is "other"', () => {
    const other: Stance = { ...stance, role: 'other' };
    expect(checkIntake({ ...complete, stance: other, objective: 'other' }).missing).toEqual(['stance', 'objective']);
    const described: Stance = { ...other, roleDescription: 'Intervenant' };
    expect(checkIntake({ ...complete, stance: described, objective: 'other' }).complete).toBe(true);
  });

  it('cannot validate the objective until the stance is confirmed', () => {
    expect(checkIntake({ ...complete, stance: undefined }).missing).toEqual(['stance', 'objective']);
  });
});

describe('US-02 objective options are computed from the confirmed stance', () => {
  it('claimant options', () => {
    expect(objectiveOptions(stance)).toEqual(['annulment', 'reduction', 'damages', 'other']);
  });
  it('defendant options', () => {
    expect(objectiveOptions({ ...stance, role: 'defendant' })).toEqual([
      'dismissal',
      'limit-remedy',
      'reduce-amount',
      'other',
    ]);
  });
  it('other role only offers free text', () => {
    expect(objectiveOptions({ ...stance, role: 'other', roleDescription: 'x' })).toEqual(['other']);
  });
  it('no stance → no options (never assumed)', () => {
    expect(objectiveOptions(undefined)).toEqual([]);
  });
});

describe('US-02 follow-up questions', () => {
  it('asks at most 3 questions at a time, in field order', () => {
    expect(nextIntakeQuestions(['court', 'areaOfLaw', 'stance', 'objective'])).toEqual([
      'intake.ask.court',
      'intake.ask.areaOfLaw',
      'intake.ask.stance',
    ]);
  });
  it('asks nothing when complete', () => {
    expect(nextIntakeQuestions([])).toEqual([]);
  });
});
