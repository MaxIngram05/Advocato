import type { ExhibitSegment, Fact, SourceRef } from '../model';

/** US-04 / G3: a fact without any source can only be a hypothesis or missing. */
export function applyFactRules(fact: Fact): Fact {
  if (fact.sourceRefs.length === 0 && (fact.status === 'provided' || fact.status === 'proven')) {
    return { ...fact, status: 'hypothesis' };
  }
  return fact;
}

/** Whitespace- and quote-insensitive form used to match excerpts against exhibit text. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\s\u00A0\u202F]+/g, ' ')
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, '"')
    .trim();
}

/**
 * Keeps only references whose excerpt really appears in the exhibit text. The locator
 * is corrected when the excerpt is found on another page or paragraph.
 */
export function verifySourceRefs(
  refs: SourceRef[],
  texts: Map<string, ExhibitSegment[]>,
): { kept: SourceRef[]; dropped: SourceRef[] } {
  const kept: SourceRef[] = [];
  const dropped: SourceRef[] = [];
  for (const ref of refs) {
    const segments = texts.get(ref.exhibitId) ?? [];
    const needle = normalizeForMatch(ref.excerpt);
    const ordered = [...segments].sort((a, b) => Number(b.locator === ref.locator) - Number(a.locator === ref.locator));
    const hit = needle ? ordered.find((s) => normalizeForMatch(s.text).includes(needle)) : undefined;
    if (hit) kept.push({ ...ref, locator: hit.locator });
    else dropped.push(ref);
  }
  return { kept, dropped };
}

/** Timeline order: dated facts first (ISO prefixes sort naturally), undated last, ties by id. */
export function sortTimeline(facts: Fact[]): Fact[] {
  const byId = (a: Fact, b: Fact) => a.id.localeCompare(b.id, 'en', { numeric: true });
  return [...facts].sort((a, b) => {
    if (a.date && b.date) return a.date === b.date ? byId(a, b) : a.date < b.date ? -1 : 1;
    if (a.date) return -1;
    if (b.date) return 1;
    return byId(a, b);
  });
}

/** Switching between the two sides of the same dispute inverts favorability (§7). */
export function flipFavorability(facts: Fact[]): Fact[] {
  const flip = { favorable: 'unfavorable', unfavorable: 'favorable', neutral: 'neutral' } as const;
  return facts.map((f) => ({ ...f, favorability: flip[f.favorability] }));
}
