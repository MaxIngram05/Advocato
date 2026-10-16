import { z } from 'zod';
import { FactPool } from '../core/facts/FactPool';
import type { Alert, CaseFile, Citation } from '../core/model';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import type { AllowedSource } from '../llm/PromptBuilder';
import type { IdGenerator, JurisprudenceHit, JurisprudenceSearch } from '../ports';
import type { CaseUpdate } from './ExtractFacts';

const Ids = z.array(z.string());

/** MVP: one grounded LLM step producing every section of the §8 document. */
export const AnalysisSchema = z.object({
  legalQuestions: z.array(z.string()),
  rules: z.array(z.object({ rule: z.string(), citationIds: Ids })),
  causeOfAction: z.string(),
  matrix: z.array(
    z.object({
      element: z.string(),
      factIds: Ids,
      evidence: z.string(),
      analysis: z.string(),
      gap: z.string().nullable().optional(),
      argument: z.string(),
      conclusionSought: z.string(),
      citationIds: Ids,
      confidence: z.enum(['established', 'arguable', 'weak', 'missing']),
    }),
  ),
  damages: z.array(z.object({ head: z.string(), quantum: z.string(), evidence: z.string(), gap: z.string().nullable().optional() })),
  remedy: z.object({
    principal: z.object({ remedy: z.string(), justification: z.string(), citationIds: Ids }),
    alternatives: z.array(z.object({ remedy: z.string(), justification: z.string(), citationIds: Ids })),
    rejected: z.array(z.object({ remedy: z.string(), reason: z.string() })),
  }),
  unfavorable: z.array(
    z.object({ item: z.string(), factIds: Ids, impact: z.string(), response: z.string(), residualRisk: z.enum(['low', 'medium', 'high']) }),
  ),
  arguments: z.array(
    z.object({
      title: z.string(),
      text: z.string(),
      factIds: Ids,
      citationIds: Ids,
      counterArguments: z.array(
        z.object({
          text: z.string(),
          origin: z.enum(['stated', 'anticipated']),
          rebuttals: z.array(z.object({ text: z.string(), factIds: Ids, citationIds: Ids })),
        }),
      ),
    }),
  ),
  conclusions: z.object({ principal: z.array(z.string()), alternative: z.array(z.string()) }),
  uncertainties: z.array(z.string()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

const ALLOWLIST = ['legisquebec.gouv.qc.ca', 'laws-lois.justice.gc.ca', 'canlii.org', 'scc-csc.lexum.com', 'decisions.scc-csc.ca', 'soquij.qc.ca', 'caij.qc.ca'];
const allowed = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return ALLOWLIST.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

function toCitation(id: string, hit: JurisprudenceHit, at: string): Citation {
  const article = hit.kind === 'legislation' ? hit.title.match(/-\s*(\d+(?:\.\d+)?)\s*:/)?.[1] : undefined;
  const kind = hit.kind === 'case' ? 'case' : hit.kind === 'legislation' ? 'statute' : 'doctrine';
  const verified = allowed(hit.url) && (kind !== 'case' || !!hit.neutralCitation);
  return {
    id,
    kind,
    title: hit.title,
    ...(hit.neutralCitation ? { neutralCitation: hit.neutralCitation } : {}),
    ...(article ? { article, instrument: hit.title.split(':')[1]?.trim() ?? hit.title } : {}),
    pinpoint: article ? `art ${article}` : (hit.neutralCitation ?? hit.title),
    url: hit.url,
    verification: verified
      ? { state: 'verified', method: 'caij', checkedAt: at }
      : { state: 'unverified', reason: hit.neutralCitation || kind !== 'case' ? 'host-not-allowlisted' : 'no-neutral-citation' },
  };
}

/** MVP analysis: CAIJ retrieval → ALLOWED_SOURCES → one grounded LLM call (G1, G8, G10). */
export class AnalyseCase {
  constructor(
    private readonly llm: GroundedGenerator,
    private readonly search: JurisprudenceSearch,
    private readonly ids: IdGenerator,
    private readonly now: () => Date,
  ) {}

  async execute(caseFile: CaseFile): Promise<CaseUpdate> {
    const selected = new FactPool(caseFile.facts, caseFile.session).selected();
    const alerts: Alert[] = [];
    const topic = selected.map((f) => f.text).join(' ').slice(0, 600);
    const queries = [
      `${caseFile.causesOfAction.includes('COA_LATENT_DEFECT') || caseFile.causesOfAction.length === 0 ? 'garantie de qualité vice caché vente' : caseFile.causesOfAction.join(' ')} ${caseFile.areaOfLaw}: ${topic}`.slice(0, 900),
    ];
    let hits: JurisprudenceHit[] = [];
    try {
      const results = await Promise.all(queries.map((text) => this.search.search({ text, lang: caseFile.lang, limit: 10 })));
      hits = results.flat();
    } catch (e) {
      alerts.push({ id: this.ids.next('AL'), severity: 'critical', message: `CAIJ unavailable — no case law retrieved (${e instanceof Error ? e.message : String(e)}).` });
    }
    const top = [
      ...hits.filter((h) => h.kind === 'legislation').slice(0, 8),
      ...hits.filter((h) => h.kind === 'case').slice(0, 10),
      ...hits.filter((h) => h.kind === 'doctrine').slice(0, 3),
    ];
    const at = this.now().toISOString();
    const citations = top.map((h, i) => toCitation(`S-${i + 1}`, h, at));
    const sources: AllowedSource[] = top.map((h, i) => ({
      id: `S-${i + 1}`,
      title: h.title,
      pinpoints: [citations[i]?.pinpoint ?? h.title],
      excerpt: h.passages[0]?.text.slice(0, 700) ?? '',
    }));

    const result = await this.llm.run({
      task: 'buildAnalysis',
      caseFile,
      schema: AnalysisSchema,
      allowedSources: sources,
      facts: selected,
      payload: {
        opposingArgumentsAlreadyRaised: caseFile.opposingArguments,
        allFacts: caseFile.facts.map((f) => ({ id: f.id, text: f.text, status: f.status, favorability: f.favorability })),
        objective: caseFile.objective,
      },
    });
    alerts.push(...result.alerts);
    for (const u of result.value.uncertainties) alerts.push({ id: this.ids.next('AL'), severity: 'warning', message: u });

    return {
      caseFile: {
        ...caseFile,
        citations,
        analysis: result.value,
        alerts: [...caseFile.alerts, ...alerts],
        llmCalls: [...caseFile.llmCalls, ...result.calls],
      },
      alerts,
    };
  }
}
