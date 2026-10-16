import type { CaseFile, Citation } from '../core/model';
import type { RenderedBlock, RenderedSection } from '../ports';
import type { Analysis } from './AnalyseCase';

const L = {
  fr: {
    banner: '⚠ Projet — à valider par un juriste avant tout dépôt, envoi ou usage dans une procédure',
    title: 'Argumentaire — {client}',
    header: 'Tribunal : {court} · Domaine : {area} · Client : {client} ({role}) · Date des faits : {date} · Généré le {today}',
    s1: '1. Résumé des faits pertinents et questions juridiques',
    s2: '2. Règles applicables',
    s3: '3. Fondement du recours',
    s4: '4. Matrice d’argumentation',
    s5: '5. Dommages et préjudice',
    s6: '6. Réparation recherchée et justification',
    s7: '7. Preuve défavorable et traitement',
    s8: '8. Arguments principaux et subsidiaires',
    s9: '9. Meilleurs arguments adverses et réponses',
    s10: '10. Conclusions recherchées',
    s11: '11. Table des autorités',
    s12: '12. Points à vérifier par le juriste',
    cols: ['Élément juridique requis', 'Fait pertinent', 'Preuve', 'Analyse / lacune', 'Argument', 'Conclusion demandée'],
    principal: 'Principale',
    alternative: 'Subsidiaire',
    rejected: 'Écartée',
    impact: 'Incidence',
    response: 'Réponse',
    risk: 'Risque résiduel',
    counter: 'Contre-argument',
    rebuttal: 'Réplique',
    unverified: '⚠ Non vérifié',
  },
  en: {
    banner: '⚠ Draft — must be validated by a lawyer before filing, sending or use in proceedings',
    title: 'Argument — {client}',
    header: 'Court: {court} · Area: {area} · Client: {client} ({role}) · Date of facts: {date} · Generated {today}',
    s1: '1. Summary of relevant facts & legal questions',
    s2: '2. Applicable rules',
    s3: '3. Cause of action',
    s4: '4. Argumentation matrix',
    s5: '5. Damages / prejudice',
    s6: '6. Remedy sought & justification',
    s7: '7. Unfavorable evidence & how it is addressed',
    s8: '8. Main and supplementary arguments',
    s9: '9. Opposing party’s best arguments & responses',
    s10: '10. Proposed conclusions',
    s11: '11. Table of Authorities',
    s12: '12. Points to verify',
    cols: ['Required legal element', 'Relevant fact', 'Evidence', 'Analysis / gap', 'Argument', 'Conclusion sought'],
    principal: 'Principal',
    alternative: 'Alternative',
    rejected: 'Rejected',
    impact: 'Impact',
    response: 'Response',
    risk: 'Residual risk',
    counter: 'Counter-argument',
    rebuttal: 'Rebuttal',
    unverified: '⚠ Unverified',
  },
} as const;

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

/** McGill-style short form with pinpoint. */
export function citeShort(c: Citation): string {
  if (c.kind === 'statute' && c.article) return `art ${c.article} ${c.title.includes('Code civil') ? 'CcQ' : (c.instrument ?? '')}`.trim();
  return c.title.replace(/\s*\(CanLII\)\s*$/, '');
}

const ORDER = { statute: 0, regulation: 1, case: 2, doctrine: 3 } as const;

/** §8 document structure from the analysis (pure). Section keys are stable: they name the ranges. */
export function composeDocument(c: CaseFile, a: Analysis, today: string): RenderedSection[] {
  const l = L[c.lang];
  const byId = new Map(c.citations.map((x) => [x.id, x]));
  const used = new Set<string>();
  const refs = (ids: string[]) => {
    const parts = ids
      .map((id) => byId.get(id))
      .filter((x): x is Citation => !!x)
      .map((x) => {
        used.add(x.id);
        return `${citeShort(x)}${x.verification.state === 'unverified' ? ` ${l.unverified}` : ''}`;
      });
    return parts.length ? ` [${parts.join('; ')}]` : '';
  };
  const ids = (xs: string[]) => (xs.length ? ` (${xs.join(', ')})` : '');
  const h = (text: string): RenderedBlock => ({ kind: 'heading', level: 2, text });
  const p = (text: string): RenderedBlock => ({ kind: 'paragraph', text });
  const list = (items: string[]): RenderedBlock => ({ kind: 'list', items });
  const factById = new Map(c.facts.map((f) => [f.id, f]));
  const selected = c.session.selectedFactIds.map((id) => factById.get(id)).filter((f) => !!f);
  const role = c.stance?.role === 'other' ? (c.stance.roleDescription ?? '') : (c.stance?.role ?? '');

  const sections: [string, RenderedBlock[]][] = [
    [
      'header',
      [
        { kind: 'banner', text: l.banner },
        { kind: 'heading', level: 1, text: fill(l.title, { client: c.stance?.clientName ?? '' }) },
        p(fill(l.header, { court: c.court, area: c.areaOfLaw, client: c.stance?.clientName ?? '', role, date: c.dateOfFacts, today })),
      ],
    ],
    [
      's1',
      [
        h(l.s1),
        list(selected.map((f) => `${f.id} — ${f.text} (${f.status}, ${f.position}) ${f.sourceRefs.map((s) => `${s.exhibitId} ${s.locator}`).join(', ')}`)),
        list(a.legalQuestions),
      ],
    ],
    ['s2', [h(l.s2), list(a.rules.map((r) => `${r.rule}${refs(r.citationIds)}`))]],
    ['s3', [h(l.s3), p(a.causeOfAction)]],
    [
      's4',
      [
        h(l.s4),
        {
          kind: 'table',
          rows: [
            [...l.cols],
            ...a.matrix.map((r) => [
              `${r.element} (${r.confidence})`,
              r.factIds.join(', ') || '⚠',
              r.evidence || '⚠',
              `${r.analysis}${r.gap ? ` ⚠ ${r.gap}` : ''}`,
              `${r.argument}${refs(r.citationIds)}`,
              r.conclusionSought,
            ]),
          ],
        },
      ],
    ],
    ['s5', [h(l.s5), list(a.damages.map((d) => `${d.head} — ${d.quantum}. ${d.evidence}${d.gap ? ` ⚠ ${d.gap}` : ''}`))]],
    [
      's6',
      [
        h(l.s6),
        list([
          `${l.principal} : ${a.remedy.principal.remedy} — ${a.remedy.principal.justification}${refs(a.remedy.principal.citationIds)}`,
          ...a.remedy.alternatives.map((r) => `${l.alternative} : ${r.remedy} — ${r.justification}${refs(r.citationIds)}`),
          ...a.remedy.rejected.map((r) => `${l.rejected} : ${r.remedy} — ${r.reason}`),
        ]),
      ],
    ],
    [
      's7',
      [h(l.s7), list(a.unfavorable.map((u) => `${u.item}${ids(u.factIds)} — ${l.impact} : ${u.impact} ${l.response} : ${u.response} ${l.risk} : ${u.residualRisk}`))],
    ],
    [
      's8',
      [
        h(l.s8),
        ...a.arguments.flatMap((g) => [
          { kind: 'heading', level: 3, text: g.title } as RenderedBlock,
          p(`${g.text}${ids(g.factIds)}${refs(g.citationIds)}`),
          list(
            g.counterArguments.flatMap((ca) => [
              `${l.counter} (${ca.origin}) : ${ca.text}`,
              ...ca.rebuttals.map((r) => `    ${l.rebuttal} : ${r.text}${ids(r.factIds)}${refs(r.citationIds)}`),
            ]),
          ),
        ]),
      ],
    ],
    ['s9', [h(l.s9), list(a.arguments.flatMap((g) => g.counterArguments).map((ca) => `${ca.text} → ${ca.rebuttals.map((r) => r.text).join(' / ')}`))]],
    ['s10', [h(l.s10), list([...a.conclusions.principal, ...a.conclusions.alternative.map((x) => `${l.alternative} : ${x}`)])]],
  ];
  const authorities = c.citations
    .filter((x) => used.has(x.id))
    .sort((x, y) => ORDER[x.kind] - ORDER[y.kind] || (y.neutralCitation ?? '').localeCompare(x.neutralCitation ?? ''))
    .map((x) => `${citeShort(x)} — ${x.url}${x.verification.state === 'unverified' ? ` ${l.unverified}` : ''}`);
  sections.push(['s11', [h(l.s11), list(authorities)]]);
  sections.push([
    's12',
    [
      h(l.s12),
      list([
        ...c.citations.filter((x) => used.has(x.id) && x.verification.state === 'unverified').map((x) => `${l.unverified} : ${citeShort(x)}`),
        ...selected.filter((f) => f.status === 'hypothesis' || f.status === 'missing').map((f) => `${f.id} (${f.status}) : ${f.text}`),
        ...a.uncertainties,
        ...c.alerts.filter((x) => x.severity === 'critical').map((x) => `⚠ ${x.message}`),
      ]),
    ],
  ]);
  return sections.map(([key, blocks], order) => ({ key, order, blocks: blocks.filter((b) => b.kind !== 'list' || (b.items?.length ?? 0) > 0) }));
}
