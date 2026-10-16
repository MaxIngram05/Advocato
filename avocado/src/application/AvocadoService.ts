import { newCaseFile, type CaseFile, type StanceSuggestion } from '../core/model';
import { GroundedGenerator } from '../llm/GroundedGenerator';
import { PromptBuilder } from '../llm/PromptBuilder';
import type {
  CaseRepository,
  Clock,
  DocumentWriter,
  ExhibitStore,
  ExtractedDocument,
  IdGenerator,
  LlmClient,
} from '../ports';
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
    return this.persist(await new IngestDocuments(this.deps.exhibits, this.deps.ids).execute(caseFile, docs));
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

  async readSelection(): Promise<string> {
    return this.deps.writer.readSelection();
  }

  private async persist(update: CaseUpdate): Promise<CaseUpdate> {
    await this.saveCase(update.caseFile);
    return update;
  }
}
