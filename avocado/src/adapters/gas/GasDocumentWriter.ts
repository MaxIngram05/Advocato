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
