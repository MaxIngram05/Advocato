import type { DocumentWriter, RenderedBlock, RenderedSection } from '../../ports';

/** The slice of DocumentApp's Selection we read. */
export interface SelectionLike {
  getRangeElements(): {
    getElement(): { editAsText(): { getText(): string } };
    isPartial(): boolean;
    getStartOffset(): number;
    getEndOffsetInclusive(): number;
  }[];
}

/** US-03 "paste from the current doc": the selected text, one paragraph per range element. */
export function readSelectionText(selection: SelectionLike | null): string {
  if (!selection) return '';
  return selection
    .getRangeElements()
    .map((r) => {
      const text = r.getElement().editAsText().getText();
      return r.isPartial() ? text.slice(r.getStartOffset(), r.getEndOffsetInclusive() + 1) : text;
    })
    .filter((t) => t.trim().length > 0)
    .join('\n\n');
}

type Doc = GoogleAppsScript.Document.Document;
type El = GoogleAppsScript.Document.Element;

/**
 * US-09 Google Docs writer: appends each section at the end of the body (never edits existing
 * content) and wraps it in a named range so it can be found and rolled back later.
 */
export class GasDocumentWriter implements DocumentWriter {
  constructor(private readonly doc: () => Doc) {}

  async readDocument(): Promise<{ text: string; rangeNames: string[] }> {
    const d = this.doc();
    return { text: d.getBody().getText(), rangeNames: d.getNamedRanges().map((r) => r.getName()) };
  }

  async upsertSection(s: RenderedSection): Promise<{ rangeName: string }> {
    const d = this.doc();
    const body = d.getBody();
    const els: El[] = [];
    for (const block of s.blocks) els.push(...this.append(body, block));
    if (els.length > 0) {
      const range = d.newRange();
      for (const el of els) range.addElement(el);
      d.addNamedRange(s.key, range.build());
    }
    return { rangeName: s.key };
  }

  async removeRanges(rangeNames: string[]): Promise<void> {
    const d = this.doc();
    for (const name of rangeNames) {
      for (const nr of d.getNamedRanges(name)) {
        for (const re of nr.getRange().getRangeElements()) {
          const el = re.getElement();
          if (el.getParent()) el.removeFromParent();
        }
        nr.remove();
      }
    }
  }

  async readSelection(): Promise<string> {
    return readSelectionText(this.doc().getSelection() as unknown as SelectionLike | null);
  }

  private append(body: GoogleAppsScript.Document.Body, block: RenderedBlock): El[] {
    const H = DocumentApp.ParagraphHeading;
    switch (block.kind) {
      case 'banner': {
        const p = body.appendParagraph(block.text ?? '');
        p.editAsText().setBold(true).setForegroundColor('#8B1A1A');
        return [p];
      }
      case 'heading': {
        const p = body.appendParagraph(block.text ?? '');
        p.setHeading(block.level === 1 ? H.HEADING1 : block.level === 3 ? H.HEADING3 : H.HEADING2);
        return [p];
      }
      case 'paragraph': {
        const p = body.appendParagraph(block.text ?? '');
        p.setHeading(H.NORMAL);
        return [p];
      }
      case 'list':
        return (block.items ?? []).map((item) => {
          const li = body.appendListItem(item.trim());
          li.setGlyphType(DocumentApp.GlyphType.BULLET);
          if (/^\s{2,}/.test(item)) li.setNestingLevel(1);
          return li;
        });
      case 'table': {
        const rows = block.rows ?? [];
        if (rows.length === 0) return [];
        const table = body.appendTable(rows);
        table.getRow(0).editAsText().setBold(true);
        return [table];
      }
    }
  }
}
