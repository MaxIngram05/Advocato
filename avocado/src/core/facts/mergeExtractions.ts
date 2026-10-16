import type { CaseFile } from '../model';

/**
 * Merges fact extractions that ran in parallel from the same base case. Each run numbered
 * its new facts from the same starting point, so they are renumbered sequentially here
 * (alert targets follow).
 */
export function mergeExtractions(base: CaseFile, results: CaseFile[]): CaseFile {
  const baseFactIds = new Set(base.facts.map((f) => f.id));
  const baseAlertIds = new Set(base.alerts.map((a) => a.id));
  const baseCalls = base.llmCalls.length;
  let n = Math.max(0, ...base.facts.map((f) => Number(f.id.match(/^F-(\d+)$/)?.[1] ?? 0))) + 1;
  const facts = [...base.facts];
  const alerts = [...base.alerts];
  const llmCalls = [...base.llmCalls];
  const done = new Set<string>();

  results.forEach((r, runIndex) => {
    const rename = new Map<string, string>();
    for (const f of r.facts) {
      if (baseFactIds.has(f.id)) continue;
      const id = `F-${n++}`;
      rename.set(f.id, id);
      facts.push({ ...f, id });
    }
    for (const a of r.alerts) {
      if (baseAlertIds.has(a.id)) continue;
      const target = a.target && a.target.kind === 'fact' ? { ...a.target, id: rename.get(a.target.id) ?? a.target.id } : a.target;
      alerts.push({
        ...a,
        id: `${a.id}-${runIndex}`,
        message: a.message.replace(/\bF-\d+\b/g, (m) => rename.get(m) ?? m),
        ...(target ? { target } : {}),
      });
    }
    llmCalls.push(...r.llmCalls.slice(baseCalls));
    for (const e of r.exhibits) if (e.factsExtracted) done.add(e.id);
  });

  return {
    ...base,
    facts,
    alerts,
    llmCalls,
    exhibits: base.exhibits.map((e) => (done.has(e.id) ? { ...e, factsExtracted: true } : e)),
  };
}
