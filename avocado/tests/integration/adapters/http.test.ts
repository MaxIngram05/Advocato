import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FetchHttpClient } from '../../../src/adapters/http/FetchHttpClient';
import { GasHttpClient, type UrlFetchLike } from '../../../src/adapters/http/GasHttpClient';

describe('GasHttpClient (UrlFetchApp)', () => {
  it('maps the request onto UrlFetchApp with muteHttpExceptions and lower-cases headers', async () => {
    const calls: Parameters<UrlFetchLike['fetch']>[] = [];
    const urlFetch: UrlFetchLike = {
      fetch: (...args) => {
        calls.push(args);
        return { getResponseCode: () => 429, getContentText: () => '{"x":1}', getAllHeaders: () => ({ 'Retry-After': '3' }) };
      },
    };
    const res = await new GasHttpClient(urlFetch).request({
      method: 'POST',
      url: 'https://api.example/v1',
      headers: { Authorization: 'Bearer k' },
      body: '{}',
    });
    expect(calls[0]).toEqual([
      'https://api.example/v1',
      { method: 'post', headers: { Authorization: 'Bearer k' }, payload: '{}', muteHttpExceptions: true },
    ]);
    expect(res).toEqual({ status: 429, headers: { 'retry-after': '3' }, body: '{"x":1}' });
  });

  it('sends GET without a payload', async () => {
    const calls: Parameters<UrlFetchLike['fetch']>[] = [];
    const urlFetch: UrlFetchLike = {
      fetch: (...args) => {
        calls.push(args);
        return { getResponseCode: () => 200, getContentText: () => '', getAllHeaders: () => ({}) };
      },
    };
    await new GasHttpClient(urlFetch).request({ method: 'GET', url: 'u', headers: {} });
    expect(calls[0]?.[1]).toEqual({ method: 'get', headers: {}, muteHttpExceptions: true });
  });
});

describe('FetchHttpClient', () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        res.setHeader('X-Echo-Method', req.method ?? '');
        res.statusCode = 201;
        res.end(JSON.stringify({ body, auth: req.headers.authorization }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('performs the request and returns status, lower-cased headers and body', async () => {
    const res = await new FetchHttpClient().request({ method: 'POST', url: base, headers: { Authorization: 'Bearer k' }, body: 'hi' });
    expect(res.status).toBe(201);
    expect(res.headers['x-echo-method']).toBe('POST');
    expect(JSON.parse(res.body)).toEqual({ body: 'hi', auth: 'Bearer k' });
  });

  it('performs GET without a body', async () => {
    const res = await new FetchHttpClient().request({ method: 'GET', url: base, headers: {} });
    expect(JSON.parse(res.body).body).toBe('');
  });
});
