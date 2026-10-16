import { describe, expect, it } from 'vitest';
import type { Stance } from '../../../../src/core/model';
import {
  initialSessionState,
  sessionReducer,
  type SessionEvent,
  type SessionState,
} from '../../../../src/core/session/sessionMachine';

const stance: Stance = {
  role: 'claimant',
  clientName: 'Client A',
  opposingParties: ['Party B'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

const otherStance: Stance = { ...stance, role: 'defendant', clientName: 'Party B', opposingParties: ['Client A'] };

function run(events: SessionEvent[], from: SessionState = initialSessionState()): SessionState {
  return events.reduce((s, e) => {
    const next = sessionReducer(s, e);
    if (next.rejection) throw new Error(`rejected ${e.type}: ${next.rejection.reason}`);
    return next;
  }, from);
}

const toFactReview: SessionEvent[] = [
  { type: 'LANGUAGE_SET', lang: 'fr' },
  { type: 'STANCE_CONFIRMED', stance },
  { type: 'INTAKE_COMPLETE' },
  { type: 'DOCS_INGESTED', factIds: ['F-1', 'F-2', 'F-3', 'F-4'] },
];

const roundOne: SessionEvent[] = [
  ...toFactReview,
  { type: 'FACTS_SELECTED', factIds: ['F-1', 'F-2'] },
  { type: 'OPTIONS_READY', optionIds: ['A-1', 'A-2'] },
  { type: 'ARGUMENT_SELECTED', optionIds: ['A-1'], usedFactIds: ['F-1', 'F-2'] },
  { type: 'REBUTTALS_ACCEPTED' },
  { type: 'WRITTEN', rangeNames: ['avocado:c:arg:1:main'] },
];

const roundTwo: SessionEvent[] = [
  { type: 'NEXT_ROUND' },
  { type: 'FACTS_SELECTED', factIds: ['F-3'] },
  { type: 'OPTIONS_READY', optionIds: ['B-1', 'B-2'] },
  { type: 'ARGUMENT_SELECTED', optionIds: ['B-1', 'B-2'], usedFactIds: ['F-3'] },
  { type: 'REBUTTALS_ACCEPTED' },
  { type: 'WRITTEN', rangeNames: ['avocado:c:arg:2:main'] },
];

describe('§7 session state machine (US-01, US-02, US-05, US-07, US-10, US-11)', () => {
  it('starts in GREETING with no stance (G10)', () => {
    const s = initialSessionState();
    expect(s.step).toBe('GREETING');
    expect(s.stance).toBeUndefined();
    expect(s.round).toBe(1);
  });

  it('walks the happy path through the documented transitions', () => {
    const steps: string[] = [];
    let s = initialSessionState();
    for (const e of [...roundOne, { type: 'STOP' } as SessionEvent]) {
      s = sessionReducer(s, e);
      expect(s.rejection).toBeUndefined();
      steps.push(s.step);
    }
    expect(steps).toEqual([
      'INTAKE',
      'INTAKE',
      'UPLOAD',
      'FACT_REVIEW',
      'ANALYSING',
      'ARGUMENT_PICK',
      'COUNTER_REVIEW',
      'WRITING',
      'ROUND_END',
      'STASIS',
    ]);
  });

  it('INFO_MISSING keeps the session in INTAKE', () => {
    const s = run([{ type: 'LANGUAGE_SET', lang: 'en' }, { type: 'INFO_MISSING', fields: ['court'] }]);
    expect(s.step).toBe('INTAKE');
    expect(s.missingFields).toEqual(['court']);
  });

  it('rejects INTAKE_COMPLETE while the stance is not confirmed (G10)', () => {
    const s = run([{ type: 'LANGUAGE_SET', lang: 'fr' }]);
    const next = sessionReducer(s, { type: 'INTAKE_COMPLETE' });
    expect(next.step).toBe('INTAKE');
    expect(next.rejection?.reason).toBe('stance-not-confirmed');
  });

  it('rejects a stance object whose confirmedByUser flag is not true (G10)', () => {
    const s = run([{ type: 'LANGUAGE_SET', lang: 'fr' }]);
    const forged = { ...stance, confirmedByUser: false } as unknown as Stance;
    const next = sessionReducer(s, { type: 'STANCE_CONFIRMED', stance: forged });
    expect(next.stance).toBeUndefined();
    expect(next.rejection?.reason).toBe('stance-not-confirmed');
  });

  it('rejects FACTS_SELECTED with an empty set', () => {
    const s = run(toFactReview);
    const next = sessionReducer(s, { type: 'FACTS_SELECTED', factIds: [] });
    expect(next.step).toBe('FACT_REVIEW');
    expect(next.rejection?.reason).toBe('empty-selection');
  });

  it('rejects selecting facts that are not in the pool', () => {
    const s = run(toFactReview);
    const next = sessionReducer(s, { type: 'FACTS_SELECTED', factIds: ['F-99'] });
    expect(next.rejection?.reason).toBe('fact-not-in-pool');
  });

  it('round 1 requires exactly one argument', () => {
    const s = run(roundOne.slice(0, 6));
    expect(s.step).toBe('ARGUMENT_PICK');
    expect(sessionReducer(s, { type: 'ARGUMENT_SELECTED', optionIds: [], usedFactIds: [] }).rejection?.reason).toBe(
      'round-1-requires-exactly-one',
    );
    expect(
      sessionReducer(s, { type: 'ARGUMENT_SELECTED', optionIds: ['A-1', 'A-2'], usedFactIds: [] }).rejection?.reason,
    ).toBe('round-1-requires-exactly-one');
  });

  it('later rounds require at least one argument and accept several', () => {
    const s = run([...roundOne, ...roundTwo.slice(0, 3)]);
    expect(s.round).toBe(2);
    expect(sessionReducer(s, { type: 'ARGUMENT_SELECTED', optionIds: [], usedFactIds: [] }).rejection?.reason).toBe(
      'requires-at-least-one',
    );
    const ok = sessionReducer(s, { type: 'ARGUMENT_SELECTED', optionIds: ['B-1', 'B-2'], usedFactIds: ['F-3'] });
    expect(ok.rejection).toBeUndefined();
  });

  it('rejects selecting an option that was not proposed', () => {
    const s = run(roundOne.slice(0, 6));
    expect(
      sessionReducer(s, { type: 'ARGUMENT_SELECTED', optionIds: ['Z-9'], usedFactIds: [] }).rejection?.reason,
    ).toBe('unknown-option');
  });

  it('NEXT_ROUND removes used facts from the pool and increments the round (US-10)', () => {
    const s = run([...roundOne, { type: 'NEXT_ROUND' }]);
    expect(s.step).toBe('FACT_REVIEW');
    expect(s.round).toBe(2);
    expect(s.factPool).toEqual(['F-3', 'F-4']);
    expect(s.selectedFactIds).toEqual([]);
  });

  it('STOP is not allowed before the main argument is written', () => {
    const s = run(roundOne.slice(0, 6));
    expect(sessionReducer(s, { type: 'STOP' }).rejection?.reason).toBe('main-argument-not-written');
  });

  it('STOP is allowed from round 2 fact review (button visible from round 2)', () => {
    const s = run([...roundOne, { type: 'NEXT_ROUND' }, { type: 'STOP' }]);
    expect(s.step).toBe('STASIS');
  });

  it('takes a snapshot on every ARGUMENT_PICK entry', () => {
    const s = run([...roundOne, ...roundTwo.slice(0, 3)]);
    expect(s.snapshots).toHaveLength(2);
    expect(s.snapshots[0]?.round).toBe(1);
    expect(s.snapshots[0]?.factPool).toEqual(['F-1', 'F-2', 'F-3', 'F-4']);
    expect(s.snapshots[0]?.optionIds).toEqual(['A-1', 'A-2']);
    expect(s.snapshots[1]?.round).toBe(2);
    expect(s.snapshots[1]?.written).toHaveLength(1);
  });

  it('ROLLBACK(n) restores snapshot n and removes argument n and later ones (US-11)', () => {
    const s = run([...roundOne, ...roundTwo, { type: 'ROLLBACK', n: 1 }]);
    expect(s.step).toBe('ARGUMENT_PICK');
    expect(s.round).toBe(1);
    expect(s.written).toEqual([]);
    expect(s.optionIds).toEqual(['A-1', 'A-2']);
    expect(s.factPool).toEqual(['F-1', 'F-2', 'F-3', 'F-4']);
    expect(s.snapshots).toHaveLength(1);
  });

  it('ROLLBACK(2) keeps argument 1', () => {
    const s = run([...roundOne, ...roundTwo, { type: 'ROLLBACK', n: 2 }]);
    expect(s.round).toBe(2);
    expect(s.written.map((w) => w.round)).toEqual([1]);
    expect(s.factPool).toEqual(['F-3', 'F-4']);
  });

  it('ROLLBACK works from stasis', () => {
    const s = run([...roundOne, ...roundTwo, { type: 'STOP' }, { type: 'ROLLBACK', n: 2 }]);
    expect(s.step).toBe('ARGUMENT_PICK');
  });

  it('rejects ROLLBACK(n) with n greater than the number of written arguments', () => {
    const s = run(roundOne);
    expect(sessionReducer(s, { type: 'ROLLBACK', n: 2 }).rejection?.reason).toBe('rollback-out-of-range');
    expect(sessionReducer(s, { type: 'ROLLBACK', n: 0 }).rejection?.reason).toBe('rollback-out-of-range');
  });

  it('rejects ROLLBACK before anything is written', () => {
    const s = run(roundOne.slice(0, 6));
    expect(sessionReducer(s, { type: 'ROLLBACK', n: 1 }).rejection?.reason).toBe('rollback-out-of-range');
  });

  it('changing the confirmed stance after analysis started returns to FACT_REVIEW and discards options/arguments with a snapshot kept', () => {
    const before = run([...roundOne, { type: 'NEXT_ROUND' }]);
    const s = sessionReducer(before, { type: 'STANCE_CONFIRMED', stance: otherStance });
    expect(s.rejection).toBeUndefined();
    expect(s.step).toBe('FACT_REVIEW');
    expect(s.stance).toEqual(otherStance);
    expect(s.round).toBe(1);
    expect(s.written).toEqual([]);
    expect(s.optionIds).toEqual([]);
    expect(s.factPool).toEqual(['F-1', 'F-2', 'F-3', 'F-4']);
    expect(s.snapshots).toEqual([]);
    expect(s.discarded).toHaveLength(1);
    expect(s.discarded[0]?.stance).toEqual(stance);
    expect(s.discarded[0]?.written).toHaveLength(1);
  });

  it('changing the stance during intake simply replaces it', () => {
    const s = run([{ type: 'LANGUAGE_SET', lang: 'fr' }, { type: 'STANCE_CONFIRMED', stance }]);
    const next = sessionReducer(s, { type: 'STANCE_CONFIRMED', stance: otherStance });
    expect(next.step).toBe('INTAKE');
    expect(next.stance).toEqual(otherStance);
    expect(next.discarded).toEqual([]);
  });

  it('ERROR keeps the state and appends an alert (never lose data)', () => {
    const s = run(roundOne.slice(0, 5));
    const next = sessionReducer(s, { type: 'ERROR', message: 'LLM down', severity: 'critical' });
    expect(next.step).toBe(s.step);
    expect(next.selectedFactIds).toEqual(s.selectedFactIds);
    expect(next.errors).toEqual([{ message: 'LLM down', severity: 'critical' }]);
  });

  it('rejects events that are not valid in the current step', () => {
    const s = initialSessionState();
    const next = sessionReducer(s, { type: 'FACTS_SELECTED', factIds: ['F-1'] });
    expect(next.step).toBe('GREETING');
    expect(next.rejection).toEqual({ type: 'FACTS_SELECTED', reason: 'invalid-transition' });
  });

  it.each<SessionEvent>([
    { type: 'INFO_MISSING', fields: [] },
    { type: 'STANCE_CONFIRMED', stance },
    { type: 'INTAKE_COMPLETE' },
    { type: 'DOCS_INGESTED', factIds: ['F-1'] },
    { type: 'OPTIONS_READY', optionIds: ['A-1'] },
    { type: 'ARGUMENT_SELECTED', optionIds: ['A-1'], usedFactIds: [] },
    { type: 'REBUTTALS_ACCEPTED' },
    { type: 'WRITTEN', rangeNames: [] },
    { type: 'NEXT_ROUND' },
  ])('rejects $type in GREETING', (event) => {
    expect(sessionReducer(initialSessionState(), event).rejection?.reason).toBe('invalid-transition');
  });

  it('rejects STOP in stasis and in pre-analysis steps', () => {
    const stasis = run([...roundOne, { type: 'STOP' }]);
    expect(sessionReducer(stasis, { type: 'STOP' }).rejection?.reason).toBe('invalid-transition');
  });

  it('rejects ROLLBACK with a non-integer n', () => {
    expect(sessionReducer(run(roundOne), { type: 'ROLLBACK', n: 0.5 }).rejection?.reason).toBe(
      'rollback-out-of-range',
    );
  });

  it('re-entering ARGUMENT_PICK in the same round replaces that round snapshot', () => {
    const s = run([...roundOne, { type: 'ROLLBACK', n: 1 }]);
    expect(s.snapshots).toHaveLength(1);
  });

  it('clears a previous rejection on the next accepted event', () => {
    const s = sessionReducer(initialSessionState(), { type: 'STOP' });
    expect(s.rejection).toBeDefined();
    expect(sessionReducer(s, { type: 'LANGUAGE_SET', lang: 'fr' }).rejection).toBeUndefined();
  });

  it('LANGUAGE_SET after greeting only switches the language', () => {
    const s = run([...toFactReview, { type: 'LANGUAGE_SET', lang: 'en' }]);
    expect(s.step).toBe('FACT_REVIEW');
    expect(s.lang).toBe('en');
  });

  it('is pure: never mutates the input state', () => {
    const s = run(roundOne);
    const frozen = JSON.stringify(s);
    sessionReducer(s, { type: 'NEXT_ROUND' });
    sessionReducer(s, { type: 'ROLLBACK', n: 1 });
    expect(JSON.stringify(s)).toBe(frozen);
  });
});
