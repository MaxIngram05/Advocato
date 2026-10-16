import { describe, expect, it } from 'vitest';
import { augureErrorPolicy } from '../../../src/adapters/augure/AugureErrorPolicy';

const LONG = 'rosedale-1';
const policy = (status: number, code: string | undefined, attempt = 0, retryAfterSeconds?: number) =>
  augureErrorPolicy({ status, code, attempt, retryAfterSeconds, longContextModel: LONG });

describe('§10.2 AugureErrorPolicy', () => {
  it.each([
    [400, 'invalid_json'],
    [400, 'missing_field'],
    [400, 'invalid_value'],
    [400, 'invalid_attachment'],
    [400, 'model_retired'],
    [401, 'invalid_api_key'],
    [402, 'billing_inactive'],
    [404, 'model_not_found'],
    [413, 'request_too_large'],
    [418, 'teapot'],
  ])('%i %s → no retry', (status, code) => {
    expect(policy(status, code)).toEqual({ retry: false });
  });

  it('400 context_length_exceeded → one retry on the long-context model', () => {
    expect(policy(400, 'context_length_exceeded', 0)).toEqual({ retry: true, fallbackModel: LONG });
    expect(policy(400, 'context_length_exceeded', 1)).toEqual({ retry: false });
  });

  it.each([
    [429, 'rate_limit_exceeded'],
    [429, 'quota_exceeded'],
    [429, 'capacity_exceeded'],
    [503, 'residency_unavailable'],
  ])('%i %s → honor Retry-After, at most twice', (status, code) => {
    expect(policy(status, code, 0, 7)).toEqual({ retry: true, waitMs: 7000 });
    expect(policy(status, code, 1, 3)).toEqual({ retry: true, waitMs: 3000 });
    expect(policy(status, code, 2, 3)).toEqual({ retry: false });
  });

  it('defaults the wait to 1 s when Retry-After is missing', () => {
    expect(policy(429, 'rate_limit_exceeded', 0)).toEqual({ retry: true, waitMs: 1000 });
  });

  it('429 concurrency_limit_exceeded → one retry after 2 s', () => {
    expect(policy(429, 'concurrency_limit_exceeded', 0)).toEqual({ retry: true, waitMs: 2000 });
    expect(policy(429, 'concurrency_limit_exceeded', 1)).toEqual({ retry: false });
  });

  it('500 → one retry', () => {
    expect(policy(500, 'internal_error', 0)).toEqual({ retry: true });
    expect(policy(500, 'server_error', 1)).toEqual({ retry: false });
  });

  it('502 → exponential backoff, at most twice', () => {
    expect(policy(502, 'upstream_error', 0)).toEqual({ retry: true, waitMs: 1000 });
    expect(policy(502, 'empty_completion', 1)).toEqual({ retry: true, waitMs: 2000 });
    expect(policy(502, 'upstream_error', 2)).toEqual({ retry: false });
  });

  it('504 timeout → reduce context and retry once', () => {
    expect(policy(504, 'timeout', 0)).toEqual({ retry: true, reduceContext: true });
    expect(policy(504, 'timeout', 1)).toEqual({ retry: false });
  });

  it('unknown 429 code still honors Retry-After', () => {
    expect(policy(429, undefined, 0, 2)).toEqual({ retry: true, waitMs: 2000 });
  });
});
