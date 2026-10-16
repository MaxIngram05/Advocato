import { tr } from '../core/i18n';
import { fingerprint } from '../core/exhibits/fingerprint';
import { newCaseFile, type Alert, type CaseFile, type StanceSuggestion } from '../core/model';
import { GroundedGenerator } from '../llm/GroundedGenerator';
import { PromptBuilder } from '../llm/PromptBuilder';
import type {
  CaseRepository,
  Clock,
  DocumentWriter,
  ExhibitStore,
  ExtractedDocument,
  IdGenerator,
  JurisprudenceSearch,
  LlmClient,
} from '../ports';
import { AnalyseCase } from './AnalyseCase';
import { Converse } from './Converse';
import { TranslateDocument, type TranslateResult } from './TranslateDocument';
import { WriteDocument } from './WriteDocument';
import { ExtractFacts, type CaseUpdate } from './ExtractFacts';
import { FinishIngestion } from './FinishIngestion';
import { IngestDocuments } from './IngestDocuments';
import { SuggestStance } from './SuggestStance';
import { TranscribePdf } from './TranscribePdf';

export type { CaseUpdate } from './ExtractFacts';

export interface ServiceDeps {
  repo: CaseRepository;
  exhibits: ExhibitStore;
  llm: LlmClient;
  writer: DocumentWriter;
  search?: JurisprudenceSearch;
  ids: IdGenerator;
  clock: Clock;
  /** Id of the document the add-on is open in. */
  docId: () => string;
}

/**
 * Server facade: one method per RPC (§9.2), each a single use case / LLM step.
 * The client sends its current CaseFile; every result is persisted before returning.
 */
export class AvocadoService {
  private readonly generator: GroundedGenerator;

  constructor(private readonly deps: ServiceDeps) {
    this.generator = new GroundedGenerator(deps.llm, new PromptBuilder(), deps.ids, deps.clock);
  }

  async loadCase(): Promise<CaseFile> {
    const docId = this.deps.docId();
    return (await this.deps.repo.load(docId)) ?? newCaseFile({ id: this.deps.ids.next('case'), docId, lang: 'fr' });
  }

  async saveCase(caseFile: CaseFile): Promise<void> {
    if (caseFile.docId !== this.deps.docId()) throw new Error('This case belongs to another document.');
    await this.deps.repo.save(caseFile);
  }

  async suggestStance(caseFile: CaseFile): Promise<StanceSuggestion | null> {
    return new SuggestStance(this.generator).execute(caseFile);
  }

  async ingestDocuments(caseFile: CaseFile, docs: ExtractedDocument[]): Promise<CaseUpdate> {
    // Before the stance is confirmed, exhibits cannot be numbered yet: hold them.
    if (!caseFile.stance) {
      const held = (caseFile.pendingDocs as ExtractedDocument[] | undefined) ?? [];
      const known = new Set([...held.map((d) => fingerprint(d.segments)), ...caseFile.exhibits.map((e) => e.fingerprint)]);
      const alerts: Alert[] = [];
      const fresh = docs.filter((d) => {
        const fp = fingerprint(d.segments);
        if (known.has(fp)) {
          alerts.push({ id: this.deps.ids.next('AL'), severity: 'warning', message: tr(caseFile.lang, `« ${d.name} » a déjà été reçu; il n’a pas été ajouté de nouveau.`, `"${d.name}" was already received; it was not added again.`) });
          return false;
        }
        known.add(fp);
        return true;
      });
      return this.persist({ caseFile: { ...caseFile, pendingDocs: [...held, ...fresh] }, alerts });
    }
    return this.persist(await new IngestDocuments(this.deps.exhibits, this.deps.ids).execute(caseFile, docs));
  }

  async converse(caseFile: CaseFile, message: string): Promise<CaseUpdate> {
    let update = await new Converse(this.generator, this.deps.ids, () => this.deps.clock.now()).execute(caseFile, message);
    const pending = (update.caseFile.pendingDocs as ExtractedDocument[] | undefined) ?? [];
    if (update.caseFile.stance && pending.length > 0) {
      const ingested = await new IngestDocuments(this.deps.exhibits, this.deps.ids).execute({ ...update.caseFile, pendingDocs: [] }, pending);
      update = { caseFile: ingested.caseFile, alerts: [...update.alerts, ...ingested.alerts] };
    }
    return this.persist(update);
  }

  async transcribePdf(caseFile: CaseFile, pdf: { name: string; base64: string }): Promise<CaseUpdate> {
    return this.persist(await new TranscribePdf(this.generator, this.deps.exhibits, this.deps.ids).execute(caseFile, pdf));
  }

  async extractFacts(caseFile: CaseFile, exhibitId: string): Promise<CaseUpdate> {
    return this.persist(await new ExtractFacts(this.generator, this.deps.exhibits, this.deps.ids).execute(caseFile, exhibitId));
  }

  async finishIngestion(caseFile: CaseFile): Promise<CaseUpdate> {
    return this.persist(new FinishIngestion().execute(caseFile));
  }

  async analyseCase(caseFile: CaseFile): Promise<CaseUpdate> {
    const search = this.deps.search ?? { search: () => Promise.reject(new Error('no CAIJ client configured')) };
    return this.persist(await new AnalyseCase(this.generator, search, this.deps.ids, () => this.deps.clock.now()).execute(caseFile));
  }

  async writeDocument(caseFile: CaseFile): Promise<{ caseFile: CaseFile; written: string[]; skipped: string[] }> {
    const out = await new WriteDocument(this.deps.writer).execute(caseFile, this.deps.clock.now().toISOString().slice(0, 10));
    await this.saveCase(out.caseFile);
    return out;
  }

  async translateDocument(caseFile: CaseFile): Promise<TranslateResult> {
    return new TranslateDocument(this.generator, this.deps.writer).execute(caseFile);
  }

  async readSelection(): Promise<string> {
    return this.deps.writer.readSelection();
  }

  private async persist(update: CaseUpdate): Promise<CaseUpdate> {
    await this.saveCase(update.caseFile);
    return update;
  }
}
