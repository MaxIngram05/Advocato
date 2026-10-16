import { exhibitPrefix, nextExhibitIds } from '../core/exhibits/exhibitNumbering';
import { fingerprint } from '../core/exhibits/fingerprint';
import type { Alert, CaseFile, Exhibit } from '../core/model';
import type { ExhibitStore, ExtractedDocument, IdGenerator } from '../ports';

export type { ExtractedDocument } from '../ports';

export interface IngestResult {
  caseFile: CaseFile;
  alerts: Alert[];
}

/** US-03: turns extracted documents into numbered exhibits with stored text. */
export class IngestDocuments {
  constructor(
    private readonly store: ExhibitStore,
    private readonly ids: IdGenerator,
  ) {}

  async execute(caseFile: CaseFile, docs: ExtractedDocument[]): Promise<IngestResult> {
    const prefix = exhibitPrefix(caseFile.stance);
    const alerts: Alert[] = [];
    const seen = new Map(caseFile.exhibits.filter((e) => e.fingerprint).map((e) => [e.fingerprint as string, e.id]));
    const batch = new Map<string, string>();
    const usable = docs.filter((d) => {
      if (d.segments.length > 0) {
        const fp = fingerprint(d.segments);
        const dup = seen.get(fp) ?? batch.get(fp);
        if (dup) {
          alerts.push({
            id: this.ids.next('AL'),
            severity: 'warning',
            message: `"${d.name}" is identical to ${dup}; it was not added again.`,
          });
          return false;
        }
        batch.set(fp, d.name);
        return true;
      }
      alerts.push({
        id: this.ids.next('AL'),
        severity: 'warning',
        message: `No text could be extracted from "${d.name}". Please provide another format (text PDF, DOCX or TXT).`,
      });
      return false;
    });
    const exhibitIds = nextExhibitIds(caseFile.exhibits, prefix, usable.length);
    const exhibits: Exhibit[] = [];
    for (const [i, doc] of usable.entries()) {
      const id = exhibitIds[i] as string;
      const textRef = await this.store.put(caseFile.id, id, doc.segments);
      exhibits.push({
        id,
        name: doc.name,
        mime: doc.mime,
        textRef,
        fingerprint: fingerprint(doc.segments),
        ...(doc.pages ? { pages: doc.pages } : {}),
        ...(doc.ocr ? { ocr: true } : {}),
      });
      if (doc.ocr) {
        alerts.push({
          id: this.ids.next('AL'),
          severity: 'info',
          message: `${id} was transcribed by OCR; please spot-check it against the original.`,
          target: { kind: 'element', id },
        });
      }
    }
    return {
      caseFile: {
        ...caseFile,
        exhibits: [...caseFile.exhibits, ...exhibits],
        alerts: [...caseFile.alerts, ...alerts],
      },
      alerts,
    };
  }
}
