import type { Alert, CaseFile, StanceSuggestion } from '../../core/model';
import type { ExtractedDocument } from '../../ports';

export interface CaseUpdate {
  caseFile: CaseFile;
  alerts: Alert[];
}

/**
 * Typed, Promise-based view of the server RPCs (§9.2). Production wraps
 * `google.script.run`; dev and tests call the application in process.
 */
export interface ServerGateway {
  /** Loads the case attached to the open document, or a fresh one (no stance, G10). */
  loadCase(): Promise<CaseFile>;
  saveCase(caseFile: CaseFile): Promise<void>;
  /** Never auto-applied: the lawyer must confirm (G10). */
  suggestStance(caseFile: CaseFile): Promise<StanceSuggestion | null>;
  ingestDocuments(caseFile: CaseFile, docs: ExtractedDocument[]): Promise<CaseUpdate>;
  transcribePdf(caseFile: CaseFile, pdf: { name: string; base64: string }): Promise<CaseUpdate>;
  extractFacts(caseFile: CaseFile, exhibitId: string): Promise<CaseUpdate>;
  finishIngestion(caseFile: CaseFile): Promise<CaseUpdate>;
  readSelection(): Promise<string>;
  analyseCase(caseFile: CaseFile): Promise<CaseUpdate>;
  converse(caseFile: CaseFile, message: string): Promise<CaseUpdate>;
}
