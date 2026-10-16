import { lowerCaseKeys, type HttpClient, type HttpRequest, type HttpResponse } from './HttpClient';

/** The slice of UrlFetchApp we use. */
export interface UrlFetchLike {
  fetch(
    url: string,
    params: { method: 'get' | 'post' | 'patch'; headers: Record<string, string>; payload?: string; muteHttpExceptions: boolean },
  ): { getResponseCode(): number; getContentText(charset?: string): string; getAllHeaders(): object };
}

/** Apps Script implementation: synchronous UrlFetchApp behind the async port (§9.2). */
export class GasHttpClient implements HttpClient {
  constructor(private readonly urlFetch: UrlFetchLike) {}

  async request(req: HttpRequest): Promise<HttpResponse> {
    const res = this.urlFetch.fetch(req.url, {
      method: req.method === 'GET' ? 'get' : 'post',
      headers: req.headers,
      ...(req.body !== undefined ? { payload: req.body } : {}),
      muteHttpExceptions: true,
    });
    return {
      status: res.getResponseCode(),
      headers: lowerCaseKeys(res.getAllHeaders() as Record<string, unknown>),
      body: res.getContentText('UTF-8'),
    };
  }
}
