import { describe, expect, it } from 'vitest';
import { GasDriveRest } from '../../../src/adapters/gas/GasDriveRest';
import type { UrlFetchLike } from '../../../src/adapters/http/GasHttpClient';

type Call = { url: string; method: string; headers: Record<string, string>; payload?: string };

/** Minimal in-memory Drive v3 REST server behind a UrlFetchApp stand-in. */
function fakeDriveApi() {
  const files = new Map<string, { name: string; mimeType: string; content: string; trashed: boolean }>();
  const calls: Call[] = [];
  let seq = 0;
  const reply = (status: number, body: unknown) => ({
    getResponseCode: () => status,
    getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)),
    getAllHeaders: () => ({}),
  });
  const urlFetch: UrlFetchLike = {
    fetch: (url, params) => {
      calls.push({ url, method: params.method, headers: params.headers, ...(params.payload ? { payload: params.payload } : {}) });
      const u = new URL(url);
      const id = u.pathname.split('/').pop() ?? '';
      if (params.method === 'post' && u.pathname === '/upload/drive/v3/files') {
        const boundary = params.headers['Content-Type']?.split('boundary=')[1] ?? '';
        const parts = (params.payload ?? '').split(`--${boundary}`).filter((p) => p.trim() && p.trim() !== '--');
        const meta = JSON.parse(parts[0]?.split('\r\n\r\n')[1]?.trim() ?? '{}') as { name: string; mimeType: string };
        const content = parts[1]?.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') ?? '';
        const newId = `f${++seq}`;
        files.set(newId, { ...meta, content, trashed: false });
        return reply(200, { id: newId });
      }
      const file = files.get(id);
      if (!file) return reply(404, { error: { code: 404, message: 'File not found' } });
      if (params.method === 'patch') {
        file.content = params.payload ?? '';
        return reply(200, { id });
      }
      if (u.searchParams.get('alt') === 'media') return reply(200, file.content);
      return reply(200, { id, trashed: file.trashed });
    },
  };
  return { urlFetch, files, calls };
}

describe('§12 GasDriveRest (Drive v3 REST with the drive.file scope)', () => {
  it('creates a file with a multipart upload, authenticated with the script OAuth token', () => {
    const api = fakeDriveApi();
    const drive = new GasDriveRest(api.urlFetch, () => 'tok');
    const file = drive.createFile('Avocado – Doc – d1.json', '{"a":"é"}', 'application/json');
    expect(api.files.get(file.getId())).toEqual({ name: 'Avocado – Doc – d1.json', mimeType: 'application/json', content: '{"a":"é"}', trashed: false });
    expect(api.calls[0]?.url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    expect(api.calls[0]?.headers.Authorization).toBe('Bearer tok');
  });

  it('reads, overwrites and checks a file', () => {
    const api = fakeDriveApi();
    const drive = new GasDriveRest(api.urlFetch, () => 'tok');
    const id = drive.createFile('x', 'v1', 'application/json').getId();
    const f = drive.getFileById(id);
    expect(f.getBlob().getDataAsString()).toBe('v1');
    f.setContent('v2');
    expect(drive.getFileById(id).getBlob().getDataAsString()).toBe('v2');
    expect(f.isTrashed()).toBe(false);
    const patch = api.calls.find((c) => c.method === 'patch');
    expect(patch?.url).toBe(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`);
  });

  it('throws for a file that does not exist (or is not visible to the app)', () => {
    const api = fakeDriveApi();
    expect(() => new GasDriveRest(api.urlFetch, () => 'tok').getFileById('nope')).toThrow(/404/);
  });

  it('reports trashed files', () => {
    const api = fakeDriveApi();
    const drive = new GasDriveRest(api.urlFetch, () => 'tok');
    const id = drive.createFile('x', 'v', 'application/json').getId();
    const stored = api.files.get(id);
    if (stored) stored.trashed = true;
    expect(drive.getFileById(id).isTrashed()).toBe(true);
  });
});
