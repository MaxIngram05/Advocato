import { exhibitPrefix, nextExhibitIds } from '../../core/exhibits/exhibitNumbering';
import { newCaseFile, type CaseFile, type StanceSuggestion } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import type { CaseUpdate, ServerGateway } from './ServerGateway';

const notScripted = (what: string) => Promise.reject(new Error(`FakeServerGateway: ${what} is not scripted`));

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** In-memory gateway for component tests. Records every call. */
export class FakeServerGateway implements ServerGateway {
  readonly saved: CaseFile[] = [];
  readonly ingested: ExtractedDocument[][] = [];
  selection = '';
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

  async ingestDocuments(caseFile: CaseFile, docs: ExtractedDocument[]): Promise<CaseUpdate> {
    this.ingested.push(clone(docs));
    const ids = nextExhibitIds(caseFile.exhibits, exhibitPrefix(caseFile.stance), docs.length);
    const exhibits = docs.map((d, i) => ({ id: ids[i] as string, name: d.name, mime: d.mime, textRef: `fake:${ids[i]}` }));
    return { caseFile: { ...caseFile, exhibits: [...caseFile.exhibits, ...exhibits] }, alerts: [] };
  }

  async readSelection(): Promise<string> {
    return this.selection;
  }

  transcribePdf(): Promise<CaseUpdate> {
    return notScripted('transcribePdf');
  }

  extractFacts(): Promise<CaseUpdate> {
    return notScripted('extractFacts');
  }

  analyseCase(): Promise<CaseUpdate> {
    return notScripted('analyseCase');
  }

  finishIngestion(): Promise<CaseUpdate> {
    return notScripted('finishIngestion');
  }
}
