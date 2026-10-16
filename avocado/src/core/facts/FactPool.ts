import type { Fact, SessionState } from '../model';
import { sortTimeline } from './factRules';

/** US-05 / US-10: the facts still available for selection in the current round. */
export class FactPool {
  constructor(
    private readonly facts: Fact[],
    private readonly session: Pick<SessionState, 'factPool' | 'selectedFactIds'>,
  ) {}

  selectable(): Fact[] {
    const pool = new Set(this.session.factPool);
    return sortTimeline(this.facts.filter((f) => pool.has(f.id)));
  }

  selected(): Fact[] {
    const chosen = new Set(this.session.selectedFactIds);
    return sortTimeline(this.facts.filter((f) => chosen.has(f.id)));
  }
}
