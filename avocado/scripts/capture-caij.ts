/**
 * M6 spike (§10.1): sends representative queries to the CAIJ semantic search API and
 * saves the raw SSE bodies to tests/fixtures/caij/*.sse. The parser and the
 * JurisprudenceHit mapper are written from these recordings only.
 *
 *   npm run capture:caij
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { components } from '../src/adapters/gas/caij.generated';

type Request = Partial<components['schemas']['SemanticSearchRequest']> & { query: string };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/fixtures/caij');
const base = process.env.CAIJ_BASE_URL ?? 'https://hackathon.caij.qc.ca';

const quebec: NonNullable<Request['search_filters']>[number] = { type: 'jurisdiction', jurisdiction_found: true, jurisdiction_to_search: ['Québec'] };

const QUERIES: Record<string, Request> = {
  'vice-cache-elements': {
    query: 'garantie de qualité vice caché conditions grave antérieur inconnu de l’acheteur caché',
    search_types: ['jurisprudence', 'legislation'],
    top_k: 10,
    search_filters: [quebec],
    clarifications: 'Droit civil québécois, vente immobilière, Cour du Québec, faits en 2025.',
  },
  'denonciation-delai-raisonnable': {
    query: 'dénonciation écrite du vice caché dans un délai raisonnable article 1739 C.c.Q.',
    search_types: ['jurisprudence', 'legislation'],
    top_k: 10,
    search_filters: [quebec],
  },
  'vendeur-professionnel-connaissance': {
    query: 'présomption de connaissance du vice par le vendeur professionnel dommages-intérêts',
    search_types: ['jurisprudence'],
    top_k: 10,
    search_filters: [quebec],
  },
  'clause-exclusion-garantie': {
    query: 'clause d’exclusion de garantie vente aux risques et périls de l’acheteur vendeur qui connaissait le vice',
    search_types: ['jurisprudence', 'legislation', 'doctrine'],
    top_k: 10,
  },
  'latent-defect-english': {
    query: 'latent defect warranty of quality seller knowledge Quebec civil code',
    search_types: ['jurisprudence'],
    top_k: 5,
  },
};

async function capture(name: string, body: Request): Promise<void> {
  const started = Date.now();
  const res = await fetch(`${base}/semantic-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  writeFileSync(join(out, `${name}.sse`), text);
  writeFileSync(
    join(out, `${name}.meta.json`),
    JSON.stringify(
      { request: body, status: res.status, contentType: res.headers.get('content-type'), ms: Date.now() - started, bytes: text.length },
      null,
      2,
    ),
  );
  console.log(`${name}: HTTP ${res.status}, ${text.length} bytes, ${Date.now() - started} ms`);
}

mkdirSync(out, { recursive: true });
const health = await fetch(`${base}/health`);
console.log(`health: HTTP ${health.status}`);
for (const [name, body] of Object.entries(QUERIES)) await capture(name, body);
