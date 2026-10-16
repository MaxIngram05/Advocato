import type { JurisprudenceHit, JurisprudenceSearch } from '../../ports';
import type { components } from '../gas/caij.generated';
import type { HttpClient } from '../http/HttpClient';

type Request = Partial<components['schemas']['SemanticSearchRequest']> & { query: string };

interface RawResult {
  id?: string;
  document_id?: string;
  title?: string;
  content?: string;
  url?: string;
  metadata?: { url?: string; title?: string };
}

const KIND: Record<string, JurisprudenceHit['kind']> = {
  jurisprudence: 'case',
  legislation: 'legislation',
  doctrine: 'doctrine',
};

const NEUTRAL = /\b(\d{4}) (CSC|SCC|QCCA|QCCS|QCCQ|QCTAT|QCTDP|QCTAQ|[A-Z]{2,6}) (\d+)\b/;

/** Splits an SSE body into events and returns the parsed `data` of the `done` event (D22). */
export function parseCaijSse(body: string): { results?: Record<string, RawResult[]> } | null {
  for (const block of body.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    if (!lines.some((l) => l.trim() === 'event: done')) continue;
    const data = lines
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    const outer = JSON.parse(data) as { message?: string };
    return typeof outer.message === 'string' ? (JSON.parse(outer.message) as { results?: Record<string, RawResult[]> }) : null;
  }
  return null;
}

function cleanContent(text: string): string {
  return text
    .replace(/--- (BEGIN|END) PREPENDED CHUNKS ---/g, ' ')
    .replace(/CHUNK INDEX: \d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapCaijResults(parsed: { results?: Record<string, RawResult[]> } | null): JurisprudenceHit[] {
  const hits: JurisprudenceHit[] = [];
  const seen = new Set<string>();
  for (const [type, items] of Object.entries(parsed?.results ?? {})) {
    const kind = KIND[type];
    if (!kind) continue;
    for (const r of items) {
      const id = r.id ?? r.document_id;
      const url = r.metadata?.url ?? r.url;
      const title = r.title ?? r.metadata?.title;
      if (!id || !url || !title) continue;
      const neutral = title.match(NEUTRAL)?.[0];
      const key = neutral ?? id;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        id,
        kind,
        title,
        ...(neutral ? { neutralCitation: neutral } : {}),
        url,
        passages: [{ text: cleanContent(r.content ?? '').slice(0, 1200) }],
      });
    }
  }
  return hits;
}

/** §10.1 CAIJ semantic search (SSE body read whole; UrlFetchApp/fetch do not stream). */
export class CaijSearch implements JurisprudenceSearch {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    private readonly opts: { clarifications?: string; types?: Request['search_types'] } = {},
  ) {}

  async search(q: { text: string; lang: 'fr' | 'en'; limit: number }): Promise<JurisprudenceHit[]> {
    const body: Request = {
      query: q.text,
      search_types: this.opts.types ?? ['jurisprudence', 'legislation'],
      top_k: q.limit,
      min_reranker_score: 2,
      search_filters: [{ type: 'jurisdiction', jurisdiction_found: true, jurisdiction_to_search: ['Québec'] }],
      use_parallel_search: true,
      max_workers: 2,
      ...(this.opts.clarifications ? { clarifications: this.opts.clarifications } : {}),
    };
    let res = await this.http.request({
      method: 'POST',
      url: `${this.baseUrl}/semantic-search`,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
    if (res.status >= 500) {
      res = await this.http.request({
        method: 'POST',
        url: `${this.baseUrl}/semantic-search`,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
      });
    }
    if (res.status !== 200) throw new Error(`CAIJ search failed: HTTP ${res.status}`);
    return mapCaijResults(parseCaijSse(res.body));
  }
}
