import { StanceNotConfirmedError } from '../errors';
import type { Exhibit, Stance } from '../model';

const PREFIX = { claimant: 'P', defendant: 'D', other: 'I' } as const;
export type ExhibitPrefix = (typeof PREFIX)[keyof typeof PREFIX];

/** Québec practice: P-n for the claimant, D-n for the defendant, I-n for other parties (D9). */
export function exhibitPrefix(stance: Stance | undefined): ExhibitPrefix {
  if (stance?.confirmedByUser !== true) throw new StanceNotConfirmedError();
  return PREFIX[stance.role];
}

export function nextExhibitIds(existing: Exhibit[], prefix: string, count: number): string[] {
  const used = existing
    .map((e) => (e.id.startsWith(`${prefix}-`) ? e.id.slice(prefix.length + 1).match(/^(\d+)$/) : null))
    .map((m) => (m?.[1] ? Number(m[1]) : 0));
  const start = Math.max(0, ...used);
  return Array.from({ length: count }, (_, i) => `${prefix}-${start + i + 1}`);
}
