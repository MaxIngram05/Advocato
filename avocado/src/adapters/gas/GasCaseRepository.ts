import type { CaseFile } from '../../core/model';
import { migrate } from '../../core/model/migrate';
import type { CaseRepository } from '../../ports';
import type { DriveFileLike, DriveLike, PropertiesLike } from './gasTypes';

export const CASE_FILE_PROPERTY = 'avocado.caseFileId';

/**
 * §12: the CaseFile JSON lives in a Drive file created by the app (drive.file scope);
 * its id is stored in the document's DocumentProperties so the context follows the doc.
 */
export class GasCaseRepository implements CaseRepository {
  constructor(
    private readonly deps: {
      drive: DriveLike;
      propertiesFor: (docId: string) => PropertiesLike;
      docTitle: () => string;
    },
  ) {}

  async load(docId: string): Promise<CaseFile | null> {
    const file = this.linkedFile(docId);
    if (!file) return null;
    return migrate(JSON.parse(file.getBlob().getDataAsString('UTF-8')));
  }

  async save(c: CaseFile): Promise<void> {
    const json = JSON.stringify(c);
    const file = this.linkedFile(c.docId);
    if (file) {
      file.setContent(json);
      return;
    }
    const created = this.deps.drive.createFile(
      `Avocado – ${this.deps.docTitle()} – ${c.docId}.json`,
      json,
      'application/json',
    );
    this.deps.propertiesFor(c.docId).setProperty(CASE_FILE_PROPERTY, created.getId());
  }

  private linkedFile(docId: string): DriveFileLike | null {
    const id = this.deps.propertiesFor(docId).getProperty(CASE_FILE_PROPERTY);
    if (!id) return null;
    try {
      const file = this.deps.drive.getFileById(id);
      return file.isTrashed() ? null : file;
    } catch {
      return null;
    }
  }
}
