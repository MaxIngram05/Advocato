import type { ExhibitSegment } from '../model';

/** Content fingerprint (FNV-1a over whitespace/case-normalized text): same text => same fingerprint. */
export function fingerprint(segments: ExhibitSegment[]): string {
  const text = segments
    .map((s) => s.text)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}-${text.length}`;
}

/** Normalized form of a fact's text, to merge the same fact found in several exhibits. */
export const factKey = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
