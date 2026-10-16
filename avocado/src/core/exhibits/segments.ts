import type { ExhibitSegment } from '../model';

/** Paragraph locators for DOCX/TXT exhibits: blocks separated by blank lines. */
export function segmentParagraphs(text: string): ExhibitSegment[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => ({ locator: `para. ${i + 1}`, text: p }));
}

/** Page locators for PDF exhibits; pages without text are left out but keep their number. */
export function segmentPages(pages: string[]): ExhibitSegment[] {
  return pages
    .map((p, i) => ({ locator: `p. ${i + 1}`, text: p.trim() }))
    .filter((s) => s.text.length > 0);
}
