/** Live end-to-end smoke run (MVP): intake → upload → facts → analysis with real Augure + CAIJ. */
import { readFileSync, writeFileSync } from 'node:fs';
import { AugureLlmClient } from '../src/adapters/augure/AugureLlmClient';
import { CaijSearch } from '../src/adapters/caij/CaijSearch';
import { InMemoryCaseRepository } from '../src/adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../src/adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../src/adapters/fake/InMemoryExhibitStore';
import { FetchHttpClient } from '../src/adapters/http/FetchHttpClient';
import { AvocadoService } from '../src/application/AvocadoService';
import { segmentParagraphs } from '../src/core/exhibits/segments';
import { sessionReducer } from '../src/core/session/sessionMachine';

const env = Object.fromEntries(
  readFileSync('../.env', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
);
const http = new FetchHttpClient();
let n = 0;
const svc = new AvocadoService({
  repo: new InMemoryCaseRepository(),
  exhibits: new InMemoryExhibitStore(),
  llm: new AugureLlmClient({
    http,
    config: { apiKey: env.AUGURE_API_KEY ?? '', baseUrl: 'https://api.augureai.ca/v1', model: 'ossington-5', longContextModel: 'rosedale-1' },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  }),
  search: new CaijSearch(http, 'https://hackathon.caij.qc.ca'),
  writer: new InMemoryDocumentWriter(),
  ids: { next: (p) => `${p}-${++n}` },
  clock: { now: () => new Date() },
  docId: () => 'smoke',
});

const t0 = Date.now();
const lap = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
let c = await svc.loadCase();
const stance = { role: 'claimant' as const, clientName: 'IkéÔ', opposingParties: ['123 456 Québec inc.'], confirmedByUser: true as const, confirmedAt: new Date().toISOString() };
c = { ...c, lang: 'fr', court: 'Cour supérieure', areaOfLaw: 'civil', objective: 'damages', dateOfFacts: '2025-10-09', causesOfAction: ['COA_LATENT_DEFECT'], parties: [{ name: 'IkéÔ', role: 'acheteur' }, { name: '123 456 Québec inc.', role: 'vendeur' }] };
for (const e of [{ type: 'LANGUAGE_SET', lang: 'fr' }, { type: 'STANCE_CONFIRMED', stance }, { type: 'INTAKE_COMPLETE' }] as const) c.session = sessionReducer(c.session, e);
c.stance = stance;
c = (await svc.ingestDocuments(c, ['P-1', 'P-4', 'P-7'].map((id) => ({ name: `${id}.txt`, mime: 'text/plain', segments: segmentParagraphs(readFileSync(`tests/fixtures/ikeo/${id}.txt`, 'utf8')) })))).caseFile;
lap(`exhibits ${c.exhibits.map((e) => e.id).join(',')}`);
const results = await Promise.all(c.exhibits.map((e) => svc.extractFacts(c, e.id)));
c = { ...c, facts: results.flatMap((r, i) => r.caseFile.facts.map((f) => ({ ...f, id: `F-${i + 1}${f.id.slice(2).padStart(2, '0')}` }))), exhibits: c.exhibits.map((e) => ({ ...e, factsExtracted: true })) };
lap(`facts ${c.facts.length}`);
c = (await svc.finishIngestion(c)).caseFile;
c.session = sessionReducer(c.session, { type: 'FACTS_SELECTED', factIds: c.session.factPool.slice(0, 12) });
const out = await svc.analyseCase(c);
lap(`analysis: ${out.caseFile.citations.length} sources, ${(out.caseFile.analysis as { matrix: unknown[] }).matrix.length} matrix rows`);
writeFileSync('smoke-output.json', JSON.stringify(out.caseFile, null, 2));
console.log(JSON.stringify((out.caseFile.analysis as { matrix: unknown[] }).matrix[0], null, 1).slice(0, 1200));
console.log(out.alerts.map((a) => `${a.severity}: ${a.message}`).slice(0, 8).join('\n'));
