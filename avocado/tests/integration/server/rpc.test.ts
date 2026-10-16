import { describe, expect, it } from 'vitest';
import { handleRpc, RPC_METHODS } from '../../../src/server/rpc';

const fakeService = {
  loadCase: async () => ({ id: 'c' }),
  ingestDocuments: async (c: unknown, docs: unknown) => ({ caseFile: c, alerts: [], docs }),
  explode: async () => {
    throw new TypeError('boom');
  },
};

describe('§9.2 RPC dispatcher', () => {
  it('calls the named service method with JSON arguments and returns JSON', async () => {
    const out = await handleRpc(fakeService as never, 'ingestDocuments', JSON.stringify([{ id: 'c' }, [{ name: 'a' }]]));
    expect(JSON.parse(out)).toEqual({ ok: true, value: { caseFile: { id: 'c' }, alerts: [], docs: [{ name: 'a' }] } });
  });

  it('rejects methods that are not exposed', async () => {
    const out = JSON.parse(await handleRpc(fakeService as never, 'explode', '[]'));
    expect(out).toEqual({ ok: false, error: { name: 'RpcError', message: 'Unknown RPC method: explode' } });
  });

  it('serializes thrown errors (name + message), never stack traces', async () => {
    const svc = { loadCase: async () => Promise.reject(Object.assign(new Error('nope'), { name: 'StanceNotConfirmedError' })) };
    const out = JSON.parse(await handleRpc(svc as never, 'loadCase', '[]'));
    expect(out).toEqual({ ok: false, error: { name: 'StanceNotConfirmedError', message: 'nope' } });
  });

  it('carries extra error fields useful to the UI (e.g. missing intake fields)', async () => {
    const svc = { loadCase: async () => Promise.reject(Object.assign(new Error('x'), { name: 'IntakeIncompleteError', missing: ['court'] })) };
    const out = JSON.parse(await handleRpc(svc as never, 'loadCase', '[]'));
    expect(out.error.missing).toEqual(['court']);
  });

  it('exposes every gateway operation', () => {
    expect(RPC_METHODS).toEqual(
      expect.arrayContaining([
        'loadCase',
        'saveCase',
        'suggestStance',
        'ingestDocuments',
        'transcribePdf',
        'extractFacts',
        'finishIngestion',
        'readSelection',
      ]),
    );
  });
});
