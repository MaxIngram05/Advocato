import { useEffect, useRef, useState } from 'react';
import { label } from '../../core/labels';
import type { CaseFile, Citation } from '../../core/model';
import { Spinner } from '../components/Spinner';
import { describeError } from '../errors';
import type { ServerGateway } from '../gateway/ServerGateway';
import { useT } from '../i18n';

type Ids = string[];
interface Analysis {
  legalQuestions: string[];
  rules: { rule: string; citationIds: Ids }[];
  causeOfAction: string;
  matrix: {
    element: string;
    factIds: Ids;
    evidence: string;
    analysis: string;
    gap?: string | null;
    argument: string;
    conclusionSought: string;
    citationIds: Ids;
    confidence: string;
  }[];
  damages: { head: string; quantum: string; evidence: string; gap?: string | null }[];
  remedy: {
    principal: { remedy: string; justification: string; citationIds: Ids };
    alternatives: { remedy: string; justification: string; citationIds: Ids }[];
    rejected: { remedy: string; reason: string }[];
  };
  unfavorable: { item: string; factIds: Ids; impact: string; response: string; residualRisk: string }[];
  arguments: {
    title: string;
    text: string;
    factIds: Ids;
    citationIds: Ids;
    counterArguments: { text: string; origin: string; rebuttals: { text: string; factIds: Ids; citationIds: Ids }[] }[];
  }[];
  conclusions: { principal: string[]; alternative: string[] };
  uncertainties: string[];
}

const L = {
  fr: {
    working: 'Recherche CAIJ et rédaction de l’argumentation en cours… (1 à 3 minutes)',
    banner: 'Projet — à valider par un juriste avant tout dépôt, envoi ou usage dans une procédure',
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
    alternatives: 'Subsidiaires',
    rejected: 'Écartées',
    impact: 'Incidence',
    response: 'Réponse',
    risk: 'Risque résiduel',
    counter: 'Contre-argument',
    rebuttal: 'Réplique',
    unverified: '⚠ Non vérifié',
    download: 'Télécharger (.html)',
    copy: 'Copier',
    retry: 'Relancer l’analyse',
    head: 'Tribunal',
  },
  en: {
    working: 'Searching CAIJ and drafting the argument… (1 to 3 minutes)',
    banner: 'Draft — must be validated by a lawyer before filing, sending or use in proceedings',
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
    alternatives: 'Alternatives',
    rejected: 'Rejected',
    impact: 'Impact',
    response: 'Response',
    risk: 'Residual risk',
    counter: 'Counter-argument',
    rebuttal: 'Rebuttal',
    unverified: '⚠ Unverified',
    download: 'Download (.html)',
    copy: 'Copy',
    retry: 'Run the analysis again',
    head: 'Court',
  },
} as const;

/** McGill-style short form with pinpoint. */
function cite(c: Citation): string {
  if (c.kind === 'statute' && c.article) return `art ${c.article} ${c.title.includes('Code civil') ? 'CcQ' : c.instrument ?? ''}`.trim();
  return c.title.replace(/\s*\(CanLII\)\s*$/, '');
}

const ORDER = { statute: 0, regulation: 1, case: 2, doctrine: 3 } as const;

function AnalysisDocument({ caseFile, a }: { caseFile: CaseFile; a: Analysis }) {
  const l = L[caseFile.lang];
  const byId = new Map(caseFile.citations.map((c) => [c.id, c]));
  const used = new Set<string>();
  const refs = (ids: Ids) =>
    ids
      .map((id) => byId.get(id))
      .filter((c): c is Citation => !!c)
      .map((c) => {
        used.add(c.id);
        return (
          <span key={c.id}>
            {' '}
            [
            <a href={c.url} target="_blank" rel="noreferrer">
              {cite(c)}
            </a>
            {c.verification.state === 'unverified' ? ` ${l.unverified}` : ''}]
          </span>
        );
      });
  const facts = (ids: Ids) => ids.join(', ');
  const factById = new Map(caseFile.facts.map((f) => [f.id, f]));
  const selected = caseFile.session.selectedFactIds.map((id) => factById.get(id)).filter((f) => !!f);
  const stance = caseFile.stance;

  const body = (
    <>
      <p className="av-alert" data-severity="warning" role="note">
        ⚠ {l.banner}
      </p>
      <p>
        <strong>{l.head}:</strong> {caseFile.court} · {caseFile.areaOfLaw} · {stance?.clientName} ({label(caseFile.lang, stance?.role ?? '')}) ·{' '}
        {caseFile.dateOfFacts} · {new Date().toISOString().slice(0, 10)}
      </p>
      <h3>{l.s1}</h3>
      <ul>
        {selected.map((f) => (
          <li key={f.id}>
            {f.id} — {f.text} <em>({label(caseFile.lang, f.status)}, {label(caseFile.lang, f.position)})</em> {f.sourceRefs.map((s) => `${s.exhibitId} ${s.locator}`).join(', ')}
          </li>
        ))}
      </ul>
      <ul>
        {a.legalQuestions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
      <h3>{l.s2}</h3>
      <ul>
        {a.rules.map((r, i) => (
          <li key={i}>
            {r.rule}
            {refs(r.citationIds)}
          </li>
        ))}
      </ul>
      <h3>{l.s3}</h3>
      <p>{a.causeOfAction}</p>
      <h3>{l.s4}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="av-matrix">
          <thead>
            <tr>
              {l.cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.matrix.map((r, i) => (
              <tr key={i}>
                <td>
                  {r.element} <em>({label(caseFile.lang, r.confidence)})</em>
                </td>
                <td>{facts(r.factIds) || '⚠'}</td>
                <td>{r.evidence || '⚠'}</td>
                <td>
                  {r.analysis}
                  {r.gap ? ` ⚠ ${r.gap}` : ''}
                </td>
                <td>
                  {r.argument}
                  {refs(r.citationIds)}
                </td>
                <td>{r.conclusionSought}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{l.s5}</h3>
      <ul>
        {a.damages.map((d, i) => (
          <li key={i}>
            <strong>{d.head}</strong> — {d.quantum}. {d.evidence}
            {d.gap ? ` ⚠ ${d.gap}` : ''}
          </li>
        ))}
      </ul>
      <h3>{l.s6}</h3>
      <p>
        <strong>{l.principal}:</strong> {a.remedy.principal.remedy} — {a.remedy.principal.justification}
        {refs(a.remedy.principal.citationIds)}
      </p>
      {a.remedy.alternatives.length > 0 && (
        <>
          <p>
            <strong>{l.alternatives}:</strong>
          </p>
          <ul>
            {a.remedy.alternatives.map((r, i) => (
              <li key={i}>
                {r.remedy} — {r.justification}
                {refs(r.citationIds)}
              </li>
            ))}
          </ul>
        </>
      )}
      {a.remedy.rejected.length > 0 && (
        <>
          <p>
            <strong>{l.rejected}:</strong>
          </p>
          <ul>
            {a.remedy.rejected.map((r, i) => (
              <li key={i}>
                {r.remedy} — {r.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{l.s7}</h3>
      <ul>
        {a.unfavorable.map((u, i) => (
          <li key={i}>
            <strong>{u.item}</strong> {u.factIds.length ? `(${facts(u.factIds)})` : ''} — {l.impact}: {u.impact} {l.response}:{' '}
            {u.response} {l.risk}: {label(caseFile.lang, u.residualRisk)}
          </li>
        ))}
      </ul>
      <h3>{l.s8}</h3>
      {a.arguments.map((g, i) => (
        <div key={i}>
          <h4>{g.title}</h4>
          <p>
            {g.text} {g.factIds.length ? `(${facts(g.factIds)})` : ''}
            {refs(g.citationIds)}
          </p>
          <ul>
            {g.counterArguments.map((c, j) => (
              <li key={j}>
                <strong>{l.counter}</strong> ({label(caseFile.lang, c.origin)}): {c.text}
                <ul>
                  {c.rebuttals.map((r, k) => (
                    <li key={k}>
                      <strong>{l.rebuttal}:</strong> {r.text} {r.factIds.length ? `(${facts(r.factIds)})` : ''}
                      {refs(r.citationIds)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3>{l.s9}</h3>
      <ul>
        {a.arguments
          .flatMap((g) => g.counterArguments)
          .map((c, i) => (
            <li key={i}>
              {c.text} → {c.rebuttals.map((r) => r.text).join(' / ')}
            </li>
          ))}
      </ul>
      <h3>{l.s10}</h3>
      <ol>
        {a.conclusions.principal.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ol>
      {a.conclusions.alternative.length > 0 && (
        <ol>
          {a.conclusions.alternative.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      )}
      <h3>{l.s11}</h3>
      <ul>
        {caseFile.citations
          .filter((c) => used.has(c.id))
          .sort((x, y) => ORDER[x.kind] - ORDER[y.kind] || (y.neutralCitation ?? '').localeCompare(x.neutralCitation ?? ''))
          .map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {cite(c)}
              </a>
              {c.verification.state === 'unverified' ? ` ${l.unverified}` : ''}
            </li>
          ))}
      </ul>
      <h3>{l.s12}</h3>
      <ul>
        {caseFile.citations
          .filter((c) => used.has(c.id) && c.verification.state === 'unverified')
          .map((c) => (
            <li key={c.id}>
              {l.unverified}: {cite(c)}
            </li>
          ))}
        {caseFile.facts
          .filter((f) => caseFile.session.selectedFactIds.includes(f.id) && (f.status === 'hypothesis' || f.status === 'missing'))
          .map((f) => (
            <li key={f.id}>
              {f.id} ({f.status}): {f.text}
            </li>
          ))}
        {a.uncertainties.map((u, i) => (
          <li key={`u${i}`}>{u}</li>
        ))}
        {caseFile.alerts
          .filter((x) => x.severity === 'critical')
          .map((x) => (
            <li key={x.id}>⚠ {x.message}</li>
          ))}
      </ul>
    </>
  );
  return <article id="av-document">{body}</article>;
}

export function AnalysisStep({
  caseFile,
  gateway,
  onCaseFile,
  onSay,
}: {
  caseFile: CaseFile;
  gateway: ServerGateway;
  onCaseFile: (c: CaseFile) => void;
  onSay: (text: string) => void;
}) {
  const t = useT();
  const l = L[caseFile.lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);
  const analysis = caseFile.analysis as Analysis | undefined;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      onCaseFile((await gateway.analyseCase(caseFile)).caseFile);
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!analysis && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [writing, setWriting] = useState(false);
  const insert = async () => {
    setWriting(true);
    setError('');
    try {
      const out = await gateway.writeDocument(caseFile);
      onCaseFile(out.caseFile);
      onSay(
        caseFile.lang === 'fr'
          ? `J’ai lu le document puis ajouté ${out.written.length} section(s) à la fin, sans rien modifier.${out.skipped.length ? ` ${out.skipped.length} section(s) déjà présente(s) ont été laissées telles quelles.` : ''}`
          : `I read the document, then appended ${out.written.length} section(s) at the end without changing anything.${out.skipped.length ? ` ${out.skipped.length} section(s) already there were left as they are.` : ''}`,
      );
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      setWriting(false);
    }
  };

  const download = () => {
    const html = document.getElementById('av-document')?.outerHTML ?? '';
    const blob = new Blob([`<!doctype html><meta charset="utf-8"><title>Advocato</title>${html}`], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `avocado-${caseFile.id}.html`;
    a.click();
  };

  return (
    <section className="av-panel av-doc" aria-busy={busy}>
      {busy && <Spinner label={l.working} />}
      {error && (
        <p role="alert" className="av-alert" data-severity="critical">
          ⚠ {error}
        </p>
      )}
      {analysis && <AnalysisDocument caseFile={caseFile} a={analysis} />}
      {writing && <Spinner label={caseFile.lang === 'fr' ? 'Lecture du document et insertion…' : 'Reading the document and inserting…'} />}
      {analysis && (
        <p>
          <button type="button" className="av-primary" disabled={writing} onClick={() => void insert()}>
            {caseFile.lang === 'fr' ? 'Insérer dans le document' : 'Insert into the document'}
          </button>{' '}
          <button type="button" onClick={download}>
            {l.download}
          </button>{' '}
          <button type="button" onClick={() => void navigator.clipboard.writeText(document.getElementById('av-document')?.innerText ?? '')}>
            {l.copy}
          </button>
        </p>
      )}
      {!busy && (
        <button type="button" onClick={() => void run()}>
          {l.retry}
        </button>
      )}
    </section>
  );
}
