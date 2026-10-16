import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AugureLlmClient, REASONING_EFFORT } from '../../../src/adapters/augure/AugureLlmClient';
import type { HttpRequest, HttpResponse } from '../../../src/adapters/http/HttpClient';
import { LlmHttpError, LlmSchemaError, LlmTruncatedError } from '../../../src/llm/errors';

const Schema = z.object({ answer: z.string() });

const ok = (content: string, extra: Record<string, unknown> = {}, finish = 'stop'): HttpResponse => ({
  status: 200,
  headers: { 'x-request-id': 'hdr-req' },
  body: JSON.stringify({
    choices: [{ index: 0, message: { role: 'assistant', content, reasoning_content: '{"answer":"THINKING"}' }, finish_reason: finish }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    _augure: { request_id: 'req-1', inference_region: 'ca-on-toronto', gateway_region: 'ca-montreal-1', ...extra },
  }),
});

const err = (status: number, code: string, headers: Record<string, string> = {}): HttpResponse => ({
  status,
  headers,
  body: JSON.stringify({ error: { message: `boom ${code}`, type: 'x', param: null, code } }),
});

class ScriptedHttp {
  readonly requests: HttpRequest[] = [];
  constructor(private readonly responses: HttpResponse[]) {}
  async request(req: HttpRequest): Promise<HttpResponse> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (!next) throw new Error('no scripted response');
    return next;
  }
  body(i: number) {
    return JSON.parse(this.requests[i]?.body ?? '{}') as Record<string, unknown>;
  }
}

const config = { apiKey: 'sk-test', baseUrl: 'https://api.augureai.ca/v1', model: 'ossington-4-1', longContextModel: 'rosedale-1' };

function client(http: ScriptedHttp, sleeps: number[] = []) {
  return new AugureLlmClient({ http, config, sleep: async (ms) => void sleeps.push(ms) });
}

const req = { task: 'proposeArguments' as const, system: 'SYS', user: 'USER', schema: Schema };

describe('§10.2 AugureLlmClient request shape', () => {
  it('POSTs chat/completions with Bearer auth, json_schema response_format, effort and temperature, and no max_tokens', async () => {
    const http = new ScriptedHttp([ok('{"answer":"yes"}')]);
    expect(await client(http).generate(req)).toEqual({ answer: 'yes' });
    const r = http.requests[0];
    expect(r?.method).toBe('POST');
    expect(r?.url).toBe('https://api.augureai.ca/v1/chat/completions');
    expect(r?.headers.Authorization).toBe('Bearer sk-test');
    expect(r?.headers['Content-Type']).toBe('application/json');
    const body = http.body(0);
    expect(body.model).toBe('ossington-4-1');
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ]);
    expect(body.temperature).toBe(0.2);
    expect(body.reasoning_effort).toBe('high');
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('stream', true);
    const rf = body.response_format as { type: string; json_schema: { name: string; schema: Record<string, unknown> } };
    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.name).toBe('proposeArguments');
    expect(rf.json_schema.schema).toMatchObject({ type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] });
  });

  it.each(Object.entries(REASONING_EFFORT))('reasoning_effort for %s is %s', async (task, effort) => {
    const http = new ScriptedHttp([ok('{"answer":"x"}')]);
    await client(http).generate({ ...req, task: task as keyof typeof REASONING_EFFORT });
    expect(http.body(0).reasoning_effort).toBe(effort);
  });

  it('uses the effort levels from the spec', () => {
    expect(REASONING_EFFORT).toMatchObject({
      suggestNextPrompts: 'low',
      proofread: 'low',
      detectMissingInfo: 'low',
      extractFacts: 'low',
      buildMatrixRows: 'medium',
      proposeArguments: 'high',
      generateCounterArguments: 'high',
      generateRebuttals: 'high',
      justifyRemedy: 'high',
      analyseUnfavorableEvidence: 'high',
      findWeaknesses: 'high',
    });
  });

  it('reads choices[0].message.content only, never reasoning_content', async () => {
    const http = new ScriptedHttp([ok('```json\n{"answer":"final"}\n```')]);
    expect(await client(http).generate(req)).toEqual({ answer: 'final' });
  });

  it('throws LlmSchemaError with readable issues when the content does not match the schema', async () => {
    const http = new ScriptedHttp([ok('{"answer": 3}')]);
    await expect(client(http).generate(req)).rejects.toBeInstanceOf(LlmSchemaError);
  });

  it('throws LlmSchemaError when the content is not JSON', async () => {
    const http = new ScriptedHttp([ok('Sure! Here is the answer.')]);
    await expect(client(http).generate(req)).rejects.toBeInstanceOf(LlmSchemaError);
  });

  it('sends a PDF as a file content part (base64 data URL)', async () => {
    const http = new ScriptedHttp([ok('{"answer":"x"}')]);
    await client(http).generate({ ...req, task: 'transcribePdf', file: { name: 'scan.pdf', mime: 'application/pdf', base64: 'QUJD' } });
    expect(http.body(0).messages).toEqual([
      { role: 'system', content: 'SYS' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'USER' },
          { type: 'file', file: { filename: 'scan.pdf', file_data: 'data:application/pdf;base64,QUJD' } },
        ],
      },
    ]);
  });

  it('records call metadata, including fallback', async () => {
    const http = new ScriptedHttp([ok('{"answer":"x"}', { fallback: true, fallback_reason: 'primary_unavailable' })]);
    const c = client(http);
    await c.generate(req);
    expect(c.lastCall()).toEqual({
      model: 'ossington-4-1',
      requestId: 'req-1',
      inferenceRegion: 'ca-on-toronto',
      fallback: true,
      fallbackReason: 'primary_unavailable',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });

  it('starts on the long-context model when asked', async () => {
    const http = new ScriptedHttp([ok('{"answer":"x"}')]);
    await client(http).generate({ ...req, preferLongContext: true });
    expect(http.body(0).model).toBe('rosedale-1');
  });
});

describe('§10.2 AugureLlmClient error handling', () => {
  it('honors Retry-After on 429 then succeeds', async () => {
    const sleeps: number[] = [];
    const http = new ScriptedHttp([err(429, 'rate_limit_exceeded', { 'retry-after': '3' }), ok('{"answer":"x"}')]);
    expect(await client(http, sleeps).generate(req)).toEqual({ answer: 'x' });
    expect(sleeps).toEqual([3000]);
  });

  it('does not retry 401 and raises a configuration error', async () => {
    const http = new ScriptedHttp([err(401, 'invalid_api_key')]);
    const e = await client(http).generate(req).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(LlmHttpError);
    expect((e as LlmHttpError).code).toBe('invalid_api_key');
    expect(http.requests).toHaveLength(1);
  });

  it('retries context_length_exceeded once on rosedale-1', async () => {
    const http = new ScriptedHttp([err(400, 'context_length_exceeded'), ok('{"answer":"x"}')]);
    await client(http).generate(req);
    expect(http.body(1).model).toBe('rosedale-1');
  });

  it('gives up after the allowed retries', async () => {
    const http = new ScriptedHttp([err(500, 'internal_error'), err(500, 'internal_error')]);
    await expect(client(http).generate(req)).rejects.toBeInstanceOf(LlmHttpError);
    expect(http.requests).toHaveLength(2);
  });

  it('504 → retries once with the compact context', async () => {
    const http = new ScriptedHttp([err(504, 'timeout'), ok('{"answer":"x"}')]);
    await client(http).generate({ ...req, compactUser: 'SHORT' });
    expect((http.body(1).messages as { content: string }[])[1]?.content).toBe('SHORT');
  });

  it('finish_reason "length" → retry with less context, then with rosedale-1, then fail', async () => {
    const http = new ScriptedHttp([ok('{"ans', {}, 'length'), ok('{"ans', {}, 'length'), ok('{"ans', {}, 'length')]);
    await expect(client(http).generate({ ...req, compactUser: 'SHORT' })).rejects.toBeInstanceOf(LlmTruncatedError);
    expect((http.body(1).messages as { content: string }[])[1]?.content).toBe('SHORT');
    expect(http.body(1).model).toBe('ossington-4-1');
    expect(http.body(2).model).toBe('rosedale-1');
  });

  it('treats a non-JSON error body as a plain HTTP error', async () => {
    const http = new ScriptedHttp([{ status: 418, headers: {}, body: '<html>' }]);
    await expect(client(http).generate(req)).rejects.toBeInstanceOf(LlmHttpError);
  });
});

describe('§10.2 AugureLlmClient model check', () => {
  it('lists configured models missing from GET /models', async () => {
    const http = new ScriptedHttp([
      { status: 200, headers: {}, body: JSON.stringify({ object: 'list', data: [{ id: 'ossington-4-1', object: 'model', owned_by: 'augure' }] }) },
    ]);
    expect(await client(http).missingModels()).toEqual(['rosedale-1']);
    expect(http.requests[0]?.method).toBe('GET');
    expect(http.requests[0]?.url).toBe('https://api.augureai.ca/v1/models');
  });

  it('throws when the model list cannot be fetched', async () => {
    const http = new ScriptedHttp([err(401, 'invalid_api_key')]);
    await expect(client(http).missingModels()).rejects.toBeInstanceOf(LlmHttpError);
  });
});
