export interface GroundingContext {
  allowedSourceIds: string[];
  factIds: string[];
  /** When given, `exhibitId` references are checked too. */
  exhibitIds?: string[];
}

export interface GroundingIssue {
  path: string;
  kind: 'citation' | 'fact' | 'exhibit';
  id: string;
}

const FIELDS: Record<string, { kind: GroundingIssue['kind']; list: boolean }> = {
  citationIds: { kind: 'citation', list: true },
  citationId: { kind: 'citation', list: false },
  factIds: { kind: 'fact', list: true },
  factId: { kind: 'fact', list: false },
  exhibitId: { kind: 'exhibit', list: false },
};

type Json = unknown;

function allowedFor(kind: GroundingIssue['kind'], ctx: GroundingContext): Set<string> | null {
  if (kind === 'citation') return new Set(ctx.allowedSourceIds);
  if (kind === 'fact') return new Set(ctx.factIds);
  return ctx.exhibitIds ? new Set(ctx.exhibitIds) : null;
}

/** §14.3 G8: every cited source must be allowed and every fact/exhibit reference must exist. */
export function validateGrounding(value: Json, ctx: GroundingContext): GroundingIssue[] {
  const issues: GroundingIssue[] = [];
  const walk = (node: Json, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = path ? `${path}.${key}` : key;
      const field = FIELDS[key];
      const allowed = field ? allowedFor(field.kind, ctx) : null;
      if (field && allowed) {
        if (field.list && Array.isArray(child)) {
          child.forEach((id, i) => {
            if (typeof id === 'string' && !allowed.has(id)) issues.push({ path: `${childPath}[${i}]`, kind: field.kind, id });
          });
        } else if (!field.list && typeof child === 'string' && !allowed.has(child)) {
          issues.push({ path: childPath, kind: field.kind, id: child });
        }
        continue;
      }
      walk(child, childPath);
    }
  };
  walk(value, '');
  return issues;
}

/**
 * Second failure (§14.3): strip ungrounded references; an object that lost a fact or
 * exhibit reference and carries a fact `status` is downgraded to `hypothesis`.
 */
export function downgradeUngrounded<T>(value: T, issues: GroundingIssue[]): { value: T; removed: GroundingIssue[] } {
  const bad = new Set(issues.map((i) => i.path));
  /** An array element that itself points at a missing exhibit/fact/source is dropped whole. */
  const pointsNowhere = (node: Json, path: string) =>
    !!node &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    Object.keys(node).some((k) => FIELDS[k] && !FIELDS[k].list && bad.has(`${path}.${k}`));

  const walk = (node: Json, path: string): { value: Json; lost: boolean } => {
    if (Array.isArray(node)) {
      let lost = false;
      const kept: Json[] = [];
      node.forEach((child, i) => {
        const childPath = `${path}[${i}]`;
        if (pointsNowhere(child, childPath)) {
          lost = true;
          return;
        }
        const r = walk(child, childPath);
        kept.push(r.value);
      });
      return { value: kept, lost };
    }
    if (!node || typeof node !== 'object') return { value: node, lost: false };
    const out: Record<string, Json> = {};
    let lostEvidence = false;
    for (const [key, child] of Object.entries(node)) {
      const childPath = path ? `${path}.${key}` : key;
      const field = FIELDS[key];
      if (field?.list && Array.isArray(child)) {
        const kept = child.filter((_, i) => !bad.has(`${childPath}[${i}]`));
        if (kept.length !== child.length && field.kind !== 'citation') lostEvidence = true;
        out[key] = kept;
      } else if (field && !field.list && bad.has(childPath)) {
        if (field.kind !== 'citation') lostEvidence = true;
      } else {
        const r = walk(child, childPath);
        out[key] = r.value;
        if (r.lost) lostEvidence = true;
      }
    }
    if (lostEvidence && typeof out.status === 'string') out.status = 'hypothesis';
    return { value: out, lost: false };
  };
  return { value: walk(value, '').value as T, removed: issues };
}
