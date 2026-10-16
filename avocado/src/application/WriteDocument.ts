import type { CaseFile } from '../core/model';
import type { DocumentWriter } from '../ports';
import type { Analysis } from './AnalyseCase';
import { composeDocument } from './ComposeDocument';

export interface WriteResult {
  caseFile: CaseFile;
  written: string[];
  skipped: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Writes the draft into the open document without overwriting anything: the whole
 * document is read first; sections already present (same named range, or same heading
 * text typed by hand) are skipped; new sections are appended at the end.
 */
export class WriteDocument {
  constructor(private readonly writer: DocumentWriter) {}

  async execute(caseFile: CaseFile, today: string): Promise<WriteResult> {
    const analysis = caseFile.analysis as Analysis | undefined;
    if (!analysis) throw new Error('There is no draft to write yet.');
    const existing = await this.writer.readDocument();
    const text = norm(existing.text);
    const written: string[] = [];
    const skipped: string[] = [];
    for (const section of composeDocument(caseFile, analysis, today)) {
      const rangeName = `avocado:${caseFile.id}:${section.key}`;
      const heading = section.blocks.find((b) => b.kind === 'heading')?.text;
      const already = existing.rangeNames.includes(rangeName) || (!!heading && text.includes(norm(heading)));
      if (already) {
        skipped.push(section.key);
        continue;
      }
      await this.writer.upsertSection({ ...section, key: rangeName });
      written.push(section.key);
    }
    return {
      caseFile: { ...caseFile, writtenRanges: [...((caseFile.writtenRanges as string[] | undefined) ?? []), ...written.map((k) => `avocado:${caseFile.id}:${k}`)] },
      written,
      skipped,
    };
  }
}
