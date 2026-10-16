import { sortTimeline } from '../core/facts/factRules';
import { checkIntake, type IntakeField } from '../core/intake/IntakeCompletenessChecker';
import type { CaseFile } from '../core/model';
import { sessionReducer } from '../core/session/sessionMachine';
import type { CaseUpdate } from './ExtractFacts';

/** G9: analysis cannot start while required intake information is missing. */
export class IntakeIncompleteError extends Error {
  constructor(readonly missing: IntakeField[]) {
    super(`Required case information is missing: ${missing.join(', ')}`);
    this.name = 'IntakeIncompleteError';
  }
}

/** Closes the upload step once every exhibit has been analysed (DOCS_INGESTED). */
export class FinishIngestion {
  execute(caseFile: CaseFile): CaseUpdate {
    const pending = caseFile.exhibits.filter((e) => !e.factsExtracted).map((e) => e.id);
    if (pending.length > 0) throw new Error(`Facts have not been extracted yet from: ${pending.join(', ')}`);
    const check = checkIntake({
      court: caseFile.court,
      areaOfLaw: caseFile.areaOfLaw,
      stance: caseFile.stance,
      objective: caseFile.objective,
      dateOfFacts: caseFile.dateOfFacts,
      parties: caseFile.parties,
      documentCount: caseFile.exhibits.length,
    });
    if (!check.complete) throw new IntakeIncompleteError(check.missing);
    const session = sessionReducer(caseFile.session, {
      type: 'DOCS_INGESTED',
      factIds: sortTimeline(caseFile.facts).map((f) => f.id),
    });
    if (session.rejection) throw new Error(`Cannot finish ingestion: ${session.rejection.reason}`);
    return { caseFile: { ...caseFile, session }, alerts: [] };
  }
}
