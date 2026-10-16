import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient';

/** Node/browser `fetch` implementation, used by scripts and LIVE contract tests. */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs = 300_000) {}

  async request(req: HttpRequest): Promise<HttpResponse> {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      ...(req.body !== undefined ? { body: req.body } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { status: res.status, headers, body: await res.text() };
  }
}
