import { newCaseFile, type CaseFile, type StanceSuggestion } from '../../core/model';
import type { ServerGateway } from './ServerGateway';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** In-memory gateway for tests and the dev harness. Records every save. */
export class FakeServerGateway implements ServerGateway {
  readonly saved: CaseFile[] = [];
  private stored: CaseFile | null;
  private readonly suggestion: StanceSuggestion | null;

  constructor(opts: { initial?: CaseFile | null; suggestion?: StanceSuggestion | null } = {}) {
    this.stored = opts.initial ? clone(opts.initial) : null;
    this.suggestion = opts.suggestion ?? null;
  }

  async loadCase(): Promise<CaseFile> {
    return clone(this.stored ?? newCaseFile({ id: 'case-dev', docId: 'doc-dev', lang: 'fr' }));
  }

  async saveCase(caseFile: CaseFile): Promise<void> {
    this.stored = clone(caseFile);
    this.saved.push(clone(caseFile));
  }

  async suggestStance(): Promise<StanceSuggestion | null> {
    return this.suggestion ? clone(this.suggestion) : null;
  }
}
