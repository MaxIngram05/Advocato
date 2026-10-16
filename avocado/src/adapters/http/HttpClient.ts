export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
}

/** Header names are lower-cased. */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Minimal HTTP port for adapters: UrlFetchApp in Apps Script, fetch in Node scripts. */
export interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>;
}

export const lowerCaseKeys = (headers: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
