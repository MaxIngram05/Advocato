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

  /** Text typed by the user directly in the document (outside Advocato sections). */
  userText = '';

  async readDocument(): Promise<{ text: string; rangeNames: string[] }> {
    const sectionText = this.ordered()
      .flatMap((s) => s.blocks.flatMap((b) => [b.text ?? '', ...(b.items ?? []), ...(b.rows ?? []).flat()]))
      .join(' ');
    return { text: `${this.userText} ${sectionText}`, rangeNames: [...this.sections.keys()] };
  }

  async readTextBlocks(): Promise<string[]> {
    return [
      ...(this.userText ? [this.userText] : []),
      ...this.ordered().flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'table' ? (b.rows ?? []).flat() : b.kind === 'list' ? (b.items ?? []) : [b.text ?? '']))),
    ];
  }

  async replaceTextBlocks(texts: string[]): Promise<void> {
    let i = 0;
    if (this.userText) this.userText = texts[i++] ?? this.userText;
    for (const s of this.ordered()) {
      for (const b of s.blocks) {
        if (b.kind === 'table') b.rows = (b.rows ?? []).map((row) => row.map((cell) => texts[i++] ?? cell));
        else if (b.kind === 'list') b.items = (b.items ?? []).map((item) => texts[i++] ?? item);
        else b.text = texts[i++] ?? b.text;
      }
    }
  }

  async readSelection(): Promise<string> {
    return this.selection;
  }

  /** Sections in document order (for assertions). */
  ordered(): RenderedSection[] {
    return [...this.sections.values()].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  }
}
