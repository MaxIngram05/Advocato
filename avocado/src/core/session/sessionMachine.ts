import {
  initialSession,
  type Lang,
  type SessionSnapshot,
  type SessionState,
  type Severity,
  type Stance,
  type Step,
} from '../model';

export type { SessionState } from '../model';

/** §7 events. Payloads carry the ids the pure reducer needs to enforce the invariants. */
export type SessionEvent =
  | { type: 'LANGUAGE_SET'; lang: Lang }
  | { type: 'INFO_MISSING'; fields: string[] }
  | { type: 'STANCE_CONFIRMED'; stance: Stance }
  | { type: 'INTAKE_COMPLETE' }
  | { type: 'DOCS_INGESTED'; factIds: string[] }
  | { type: 'FACTS_SELECTED'; factIds: string[] }
  | { type: 'OPTIONS_READY'; optionIds: string[] }
  | { type: 'ARGUMENT_SELECTED'; optionIds: string[]; usedFactIds: string[] }
  | { type: 'REBUTTALS_ACCEPTED' }
  | { type: 'WRITTEN'; rangeNames: string[] }
  | { type: 'NEXT_ROUND' }
  | { type: 'STOP' }
  | { type: 'ROLLBACK'; n: number }
  | { type: 'ERROR'; message: string; severity: Severity };

export type RejectionReason =
  | 'invalid-transition'
  | 'stance-not-confirmed'
  | 'empty-selection'
  | 'fact-not-in-pool'
  | 'unknown-option'
  | 'round-1-requires-exactly-one'
  | 'requires-at-least-one'
  | 'main-argument-not-written'
  | 'rollback-out-of-range';

export function initialSessionState(): SessionState {
  return initialSession();
}

const PRE_ANALYSIS: readonly Step[] = ['GREETING', 'INTAKE', 'UPLOAD', 'FACT_REVIEW'];

function reject(state: SessionState, type: SessionEvent['type'], reason: RejectionReason): SessionState {
  return { ...state, rejection: { type, reason } };
}

function accept(state: SessionState, patch: Partial<SessionState>): SessionState {
  const next: SessionState = { ...state, ...patch };
  delete next.rejection;
  return next;
}

function isConfirmed(stance: Stance | undefined): stance is Stance {
  return stance?.confirmedByUser === true;
}

function snapshotOf(state: SessionState): SessionSnapshot {
  return {
    round: state.round,
    factPool: [...state.factPool],
    selectedFactIds: [...state.selectedFactIds],
    optionIds: [...state.optionIds],
    written: state.written.map((w) => ({ ...w })),
  };
}

function analysisStarted(state: SessionState): boolean {
  return !PRE_ANALYSIS.includes(state.step) || state.written.length > 0 || state.round > 1;
}

function onStanceConfirmed(state: SessionState, stance: Stance): SessionState {
  if (state.step === 'GREETING') return reject(state, 'STANCE_CONFIRMED', 'invalid-transition');
  if (!isConfirmed(stance)) return reject(state, 'STANCE_CONFIRMED', 'stance-not-confirmed');
  if (!state.stance || !analysisStarted(state)) return accept(state, { stance });
  // Changing sides invalidates every perspective-dependent result: start over, keep a copy.
  return accept(state, {
    stance,
    step: 'FACT_REVIEW',
    round: 1,
    factPool: [...state.allFactIds],
    selectedFactIds: [],
    optionIds: [],
    pendingSelection: undefined,
    written: [],
    snapshots: [],
    discarded: [...state.discarded, { ...snapshotOf(state), stance: state.stance }],
  });
}

function onArgumentSelected(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'ARGUMENT_SELECTED' }>,
): SessionState {
  if (state.round === 1 && e.optionIds.length !== 1) {
    return reject(state, e.type, 'round-1-requires-exactly-one');
  }
  if (e.optionIds.length === 0) return reject(state, e.type, 'requires-at-least-one');
  if (e.optionIds.some((id) => !state.optionIds.includes(id))) {
    return reject(state, e.type, 'unknown-option');
  }
  return accept(state, {
    step: 'COUNTER_REVIEW',
    pendingSelection: { optionIds: [...e.optionIds], usedFactIds: [...e.usedFactIds] },
  });
}

function onRollback(state: SessionState, n: number): SessionState {
  const snap = state.snapshots[n - 1];
  if (!Number.isInteger(n) || n < 1 || n > state.written.length || !snap) {
    return reject(state, 'ROLLBACK', 'rollback-out-of-range');
  }
  return accept(state, {
    step: 'ARGUMENT_PICK',
    round: snap.round,
    factPool: [...snap.factPool],
    selectedFactIds: [...snap.selectedFactIds],
    optionIds: [...snap.optionIds],
    written: snap.written.map((w) => ({ ...w })),
    pendingSelection: undefined,
    snapshots: state.snapshots.slice(0, n),
  });
}

/** Pure reducer for the §7 workflow. Invalid events return the same state with `rejection` set. */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  const { step } = state;
  switch (event.type) {
    case 'LANGUAGE_SET':
      return accept(state, { lang: event.lang, step: step === 'GREETING' ? 'INTAKE' : step });
    case 'INFO_MISSING':
      if (step !== 'INTAKE') return reject(state, event.type, 'invalid-transition');
      return accept(state, { missingFields: [...event.fields] });
    case 'STANCE_CONFIRMED':
      return onStanceConfirmed(state, event.stance);
    case 'INTAKE_COMPLETE':
      if (step !== 'INTAKE') return reject(state, event.type, 'invalid-transition');
      if (!isConfirmed(state.stance)) return reject(state, event.type, 'stance-not-confirmed');
      return accept(state, { step: 'UPLOAD', missingFields: [] });
    case 'DOCS_INGESTED':
      if (step !== 'UPLOAD') return reject(state, event.type, 'invalid-transition');
      return accept(state, {
        step: 'FACT_REVIEW',
        allFactIds: [...event.factIds],
        factPool: [...event.factIds],
      });
    case 'FACTS_SELECTED':
      if (step !== 'FACT_REVIEW') return reject(state, event.type, 'invalid-transition');
      if (event.factIds.length === 0) return reject(state, event.type, 'empty-selection');
      if (event.factIds.some((id) => !state.factPool.includes(id))) {
        return reject(state, event.type, 'fact-not-in-pool');
      }
      return accept(state, { step: 'ANALYSING', selectedFactIds: [...event.factIds] });
    case 'OPTIONS_READY': {
      if (step !== 'ANALYSING') return reject(state, event.type, 'invalid-transition');
      const entered = accept(state, { step: 'ARGUMENT_PICK', optionIds: [...event.optionIds] });
      return {
        ...entered,
        snapshots: [...state.snapshots.slice(0, state.round - 1), snapshotOf(entered)],
      };
    }
    case 'ARGUMENT_SELECTED':
      if (step !== 'ARGUMENT_PICK') return reject(state, event.type, 'invalid-transition');
      return onArgumentSelected(state, event);
    case 'REBUTTALS_ACCEPTED':
      if (step !== 'COUNTER_REVIEW') return reject(state, event.type, 'invalid-transition');
      return accept(state, { step: 'WRITING' });
    case 'WRITTEN': {
      const pending = state.pendingSelection;
      if (step !== 'WRITING' || !pending) return reject(state, event.type, 'invalid-transition');
      return accept(state, {
        step: 'ROUND_END',
        pendingSelection: undefined,
        written: [
          ...state.written,
          { round: state.round, ...pending, rangeNames: [...event.rangeNames] },
        ],
      });
    }
    case 'NEXT_ROUND': {
      if (step !== 'ROUND_END') return reject(state, event.type, 'invalid-transition');
      const used = new Set(state.written.flatMap((w) => w.usedFactIds));
      return accept(state, {
        step: 'FACT_REVIEW',
        round: state.round + 1,
        factPool: state.factPool.filter((id) => !used.has(id)),
        selectedFactIds: [],
        optionIds: [],
      });
    }
    case 'STOP':
      if (state.written.length === 0) return reject(state, event.type, 'main-argument-not-written');
      if (PRE_ANALYSIS.slice(0, 3).includes(step) || step === 'STASIS') {
        return reject(state, event.type, 'invalid-transition');
      }
      return accept(state, { step: 'STASIS', pendingSelection: undefined });
    case 'ROLLBACK':
      return onRollback(state, event.n);
    case 'ERROR':
      return accept(state, {
        errors: [...state.errors, { message: event.message, severity: event.severity }],
      });
  }
}
