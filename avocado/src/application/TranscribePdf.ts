import { segmentPages } from '../core/exhibits/segments';
import type { CaseFile } from '../core/model';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import { TranscribePdfOutputSchema } from '../llm/schemas';
import type { ExhibitStore, IdGenerator } from '../ports';
import type { CaseUpdate } from './ExtractFacts';
import { IngestDocuments } from './IngestDocuments';

/** §10.2 scanned PDFs: Augure transcribes the file; the exhibit is flagged `ocr` for a spot-check. */
export class TranscribePdf {
  constructor(
    private readonly llm: GroundedGenerator,
    private readonly store: ExhibitStore,
    private readonly ids: IdGenerator,
  ) {}

  async execute(caseFile: CaseFile, pdf: { name: string; base64: string }): Promise<CaseUpdate> {
    const result = await this.llm.run({
      task: 'transcribePdf',
      caseFile,
      schema: TranscribePdfOutputSchema,
      allowedSources: [],
      facts: [],
      payload: { file: pdf.name, instruction: 'verbatim transcription with page numbers' },
      file: { name: pdf.name, mime: 'application/pdf', base64: pdf.base64 },
    });
    const pages = [...result.value.pages].sort((a, b) => a.page - b.page);
    const texts: string[] = [];
    for (const p of pages) texts[p.page - 1] = p.text;
    const segments = segmentPages(Array.from(texts, (t) => t ?? ''));
    const ingested = await new IngestDocuments(this.store, this.ids).execute(caseFile, [
      { name: pdf.name, mime: 'application/pdf', segments, pages: texts.length, ocr: true },
    ]);
    return {
      caseFile: { ...ingested.caseFile, llmCalls: [...ingested.caseFile.llmCalls, ...result.calls] },
      alerts: [...result.alerts, ...ingested.alerts],
    };
  }
}
