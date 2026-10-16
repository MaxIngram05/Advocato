import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { AugureLlmClient } from '../adapters/augure/AugureLlmClient';
import { CaijSearch } from '../adapters/caij/CaijSearch';
import { InMemoryCaseRepository } from '../adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../adapters/fake/InMemoryExhibitStore';
import { FetchHttpClient } from '../adapters/http/FetchHttpClient';
import { AvocadoService } from '../application/AvocadoService';
import { handleRpc } from '../server/rpc';

/** Reads KEY=VALUE lines from the first .env file found (avocado/.env.local, then ../.env). */
function loadEnv(root: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [resolve(root, '.env.local'), resolve(root, '../.env')]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m?.[1] && env[m[1]] === undefined) env[m[1]] = m[2] ?? '';
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('AUGURE_') || k.startsWith('CAIJ_') || k.startsWith('COMPAGNON_')) as [string, string][]) };
}

/** Local server: the real application with live Augure + CAIJ, in-memory storage (MVP demo). */
export function avocadoDevServer(root: string): Plugin {
  return {
    name: 'avocado-dev-rpc',
    configureServer(server) {
      const env = loadEnv(root);
      const http = new FetchHttpClient(300_000);
      let n = 0;
      const service = new AvocadoService({
        repo: new InMemoryCaseRepository(),
        exhibits: new InMemoryExhibitStore(),
        llm: new AugureLlmClient({
          http,
          config: {
            apiKey: env.AUGURE_API_KEY ?? '',
            baseUrl: env.AUGURE_BASE_URL || 'https://api.augureai.ca/v1',
            model: env.AUGURE_MODEL && env.AUGURE_MODEL !== 'auto' ? env.AUGURE_MODEL : 'ossington-5',
            longContextModel: env.AUGURE_LONG_CONTEXT_MODEL || 'rosedale-1',
          },
          sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        }),
        // Compagnon (CAIJ semantic search): only for precedents and sources for the argument.
        search: new CaijSearch(http, (env.COMPAGNON_API_URL || env.CAIJ_BASE_URL || 'https://hackathon.caij.qc.ca').trim().replace(/\/+$/, '')),
        writer: new InMemoryDocumentWriter(),
        ids: { next: (p) => `${p}-${++n}` },
        clock: { now: () => new Date() },
        docId: () => 'dev-doc',
      });
      server.middlewares.use('/rpc', (req, res) => {
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString('utf8')));
        req.on('end', () => {
          const { method, args } = JSON.parse(body || '{}') as { method: string; args: string };
          void handleRpc(service, method, args).then((reply) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(reply);
          });
        });
      });
      server.config.logger.info(
        `  Avocado RPC: live Augure ${env.AUGURE_API_KEY ? '(key found)' : '(NO AUGURE_API_KEY — set it in ../.env or .env.local)'} + CAIJ`,
      );
    },
  };
}
