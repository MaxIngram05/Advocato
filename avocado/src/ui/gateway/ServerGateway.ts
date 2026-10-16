import type { CaseFile, StanceSuggestion } from '../../core/model';

/**
 * Typed, Promise-based view of the server RPCs (§9.2). The Apps Script
 * implementation wraps `google.script.run`; dev and tests use FakeServerGateway.
 */
export interface ServerGateway {
  /** Loads the case attached to the open document, or a fresh one (no stance, G10). */
  loadCase(): Promise<CaseFile>;
  saveCase(caseFile: CaseFile): Promise<void>;
  /** Never auto-applied: the lawyer must confirm (G10). */
  suggestStance(caseFile: CaseFile): Promise<StanceSuggestion | null>;
}
