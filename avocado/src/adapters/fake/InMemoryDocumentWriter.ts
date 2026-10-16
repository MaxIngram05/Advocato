import type { DocumentWriter, RenderedSection } from '../../ports';

/** In-memory Google Doc: named sections in order, plus a settable selection. */
export class InMemoryDocumentWriter implements DocumentWriter {
  selection = '';
  readonly sections = new Map<string, RenderedSection>();

  async upsertSection(s: RenderedSection): Promise<{ rangeName: string }> {
    this.sections.set(s.key, s);
    return { rangeName: s.key };
  }

  async removeRanges(rangeNames: string[]): Promise<void> {
    for (const name of rangeNames) this.sections.delete(name);
  }

  async readSelection(): Promise<string> {
    return this.selection;
  }

  /** Sections in document order (for assertions). */
  ordered(): RenderedSection[] {
    return [...this.sections.values()].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  }
}
