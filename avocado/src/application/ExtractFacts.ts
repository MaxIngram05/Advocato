import { applyFactRules, verifySourceRefs } from '../core/facts/factRules';
import type { Alert, CaseFile, Fact } from '../core/model';
import { estimateTokens } from '../llm/ContextPacker';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import { ExtractFactsOutputSchema } from '../llm/schemas';
import type { ExhibitStore, IdGenerator } from '../ports';

export interface CaseUpdate {
  caseFile: CaseFile;
  alerts: Alert[];
}

/** Above this estimate the request goes straight to the long-context model (§10.2). */
export const EXTRACTION_BUDGET_TOKENS = 60_000;

export function nextFactNumber(facts: Fact[]): number {
  return Math.max(0, ...facts.map((f) => Number(f.id.match(/^F-(\d+)$/)?.[1] ?? 0))) + 1;
}

/** US-04: one exhibit per call (one LLM step per RPC, §9.2). */
export class ExtractFacts {
  constructor(
    private readonly llm: GroundedGenerator,
    private readonly store: ExhibitStore,
    private readonly ids: IdGenerator,
  ) {}

  async execute(caseFile: CaseFile, exhibitId: string): Promise<CaseUpdate> {
    const exhibit = caseFile.exhibits.find((e) => e.id === exhibitId);
    if (!exhibit) throw new Error(`Unknown exhibit ${exhibitId}`);
    const segments = (await this.store.get(exhibit.textRef)) ?? [];
    const payload = { exhibit: { id: exhibit.id, name: exhibit.name, segments } };

    const result = await this.llm.run({
      task: 'extractFacts',
      caseFile,
      schema: ExtractFactsOutputSchema,
      allowedSources: [],
      facts: [],
      payload,
      preferLongContext: estimateTokens(payload) > EXTRACTION_BUDGET_TOKENS,
    });

    const alerts: Alert[] = [...result.alerts];
    const texts = new Map([[exhibit.id, segments]]);
    let n = nextFactNumber(caseFile.facts);
    const facts: Fact[] = result.value.facts.map((raw) => {
      const id = `F-${n++}`;
      const { kept, dropped } = verifySourceRefs(raw.sourceRefs, texts);
      for (const ref of dropped) {
        alerts.push({
          id: this.ids.next('AL'),
          severity: 'warning',
          message: `${id}: the excerpt "${ref.excerpt}" was not found in ${ref.exhibitId}; the reference was removed.`,
          target: { kind: 'fact', id },
        });
      }
      const fact = applyFactRules({
        id,
        text: raw.text,
        ...(raw.date ? { date: raw.date } : {}),
        parties: raw.parties,
        sourceRefs: kept,
        status: raw.status,
        position: raw.position,
        favorability: raw.favorability,
      });
      if (fact.status === 'hypothesis' || fact.status === 'missing') {
        alerts.push({
          id: this.ids.next('AL'),
          severity: 'warning',
          message: `${id} is ${fact.status === 'missing' ? 'missing (needed but not in the exhibits)' : 'a hypothesis (not backed by an exhibit)'}: ${fact.text}`,
          target: { kind: 'fact', id },
        });
      }
      return fact;
    });
    for (const u of result.value.uncertainties) {
      alerts.push({ id: this.ids.next('AL'), severity: 'info', message: u });
    }

    return {
      caseFile: {
        ...caseFile,
        facts: [...caseFile.facts, ...facts],
        exhibits: caseFile.exhibits.map((e) => (e.id === exhibitId ? { ...e, factsExtracted: true } : e)),
        alerts: [...caseFile.alerts, ...alerts],
        llmCalls: [...caseFile.llmCalls, ...result.calls],
      },
      alerts,
    };
  }
}
