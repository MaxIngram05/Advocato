import type { Fact, MatrixRow } from '../core/model';

export interface ExhibitExcerpt {
  exhibitId: string;
  locator: string;
  text: string;
}

export interface PackInput {
  facts: Fact[];
  rows: MatrixRow[];
  excerpts: ExhibitExcerpt[];
}

export interface Packed extends PackInput {
  estimatedTokens: number;
  /** Something was left out to stay within the budget. */
  truncated: boolean;
  /** Even the selected facts exceed the budget: use the long-context model. */
  overBudget: boolean;
}

/** Rough estimate: ~4 characters per token on the JSON form. */
export function estimateTokens(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Math.ceil(text.length / 4);
}

/** §14.3: selected facts first (always kept), then matrix rows, then exhibit excerpts. */
export function packContext(input: PackInput, budgetTokens: number): Packed {
  let used = input.facts.reduce((sum, f) => sum + estimateTokens(f), 0);
  const overBudget = used > budgetTokens;
  let truncated = false;
  const take = <T>(items: T[]): T[] =>
    items.filter((item) => {
      const cost = estimateTokens(item);
      if (used + cost > budgetTokens) {
        truncated = true;
        return false;
      }
      used += cost;
      return true;
    });
  const rows = take(input.rows);
  const excerpts = take(input.excerpts);
  return { facts: input.facts, rows, excerpts, estimatedTokens: used, truncated: truncated || overBudget, overBudget };
}
