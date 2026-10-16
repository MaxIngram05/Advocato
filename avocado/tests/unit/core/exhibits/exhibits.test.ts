import { describe, expect, it } from 'vitest';
import { StanceNotConfirmedError } from '../../../../src/core/errors';
import { exhibitPrefix, nextExhibitIds } from '../../../../src/core/exhibits/exhibitNumbering';
import { segmentPages, segmentParagraphs } from '../../../../src/core/exhibits/segments';
import type { Exhibit, Stance } from '../../../../src/core/model';

const stance = (role: Stance['role']): Stance => ({
  role,
  ...(role === 'other' ? { roleDescription: 'Mis en cause' } : {}),
  clientName: 'A',
  opposingParties: ['B'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
});

const exhibit = (id: string): Exhibit => ({ id, name: id, mime: 'text/plain', textRef: `ref-${id}` });

describe('US-03 exhibit numbering (Québec)', () => {
  it.each([
    ['claimant', 'P'],
    ['defendant', 'D'],
    ['other', 'I'],
  ] as const)('%s exhibits are numbered %s-n', (role, prefix) => {
    expect(exhibitPrefix(stance(role))).toBe(prefix);
  });

  it('refuses to number exhibits without a confirmed stance (G10)', () => {
    expect(() => exhibitPrefix(undefined)).toThrow(StanceNotConfirmedError);
  });

  it('numbers from 1', () => {
    expect(nextExhibitIds([], 'P', 3)).toEqual(['P-1', 'P-2', 'P-3']);
  });

  it('continues after the highest existing number with the same prefix, ignoring others', () => {
    expect(nextExhibitIds([exhibit('P-1'), exhibit('P-4'), exhibit('D-9')], 'P', 2)).toEqual(['P-5', 'P-6']);
  });

  it('returns nothing for zero documents', () => {
    expect(nextExhibitIds([], 'P', 0)).toEqual([]);
  });
});

describe('US-03 locators', () => {
  it('splits plain text into numbered paragraphs on blank lines', () => {
    expect(segmentParagraphs('First line\ncontinued.\n\n\nSecond.\n\n  \nThird.')).toEqual([
      { locator: 'para. 1', text: 'First line\ncontinued.' },
      { locator: 'para. 2', text: 'Second.' },
      { locator: 'para. 3', text: 'Third.' },
    ]);
  });

  it('normalizes CRLF line endings', () => {
    expect(segmentParagraphs('A\r\n\r\nB')).toEqual([
      { locator: 'para. 1', text: 'A' },
      { locator: 'para. 2', text: 'B' },
    ]);
  });

  it('returns no segment for empty text', () => {
    expect(segmentParagraphs('  \n ')).toEqual([]);
  });

  it('labels PDF pages "p. n" and keeps empty pages out', () => {
    expect(segmentPages(['Page one', '   ', 'Page three'])).toEqual([
      { locator: 'p. 1', text: 'Page one' },
      { locator: 'p. 3', text: 'Page three' },
    ]);
  });
});
