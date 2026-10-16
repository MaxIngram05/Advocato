import type { CaseFile } from '../../core/model';
import type { CaseRepository } from '../../ports';

export class InMemoryCaseRepository implements CaseRepository {
  private readonly byDoc = new Map<string, string>();

  async load(docId: string): Promise<CaseFile | null> {
    const json = this.byDoc.get(docId);
    return json ? (JSON.parse(json) as CaseFile) : null;
  }

  async save(c: CaseFile): Promise<void> {
    this.byDoc.set(c.docId, JSON.stringify(c));
  }
}
