import { describe, expect, it } from 'vitest';
import { GasServerGateway, RemoteError, type ScriptRunLike } from '../../../src/ui/gateway/GasServerGateway';

function fakeRun(respond: (method: string, args: string) => string | Error) {
  const calls: [string, string][] = [];
  const make = (success?: (v: string) => void, failure?: (e: Error) => void): ScriptRunLike => ({
    withSuccessHandler: (fn) => make(fn, failure),
    withFailureHandler: (fn) => make(success, fn),
    avocadoRpc: (method, args) => {
      calls.push([method, args]);
      const r = respond(method, args);
      setTimeout(() => (r instanceof Error ? failure?.(r) : success?.(r)), 0);
    },
  });
  return { run: make(), calls };
}

describe('§9.2 GasServerGateway (google.script.run, Promise-based)', () => {
  it('sends the method and JSON arguments through the single avocadoRpc entry point', async () => {
    const { run, calls } = fakeRun(() => JSON.stringify({ ok: true, value: 'texte' }));
    expect(await new GasServerGateway(run).readSelection()).toBe('texte');
    expect(calls).toEqual([['readSelection', '[]']]);
  });

  it('passes arguments in order', async () => {
    const { run, calls } = fakeRun(() => JSON.stringify({ ok: true, value: { caseFile: {}, alerts: [] } }));
    await new GasServerGateway(run).extractFacts({ id: 'c' } as never, 'P-1');
    expect(calls[0]).toEqual(['extractFacts', JSON.stringify([{ id: 'c' }, 'P-1'])]);
  });

  it('turns a server-side error into a RemoteError carrying its name and fields', async () => {
    const { run } = fakeRun(() => JSON.stringify({ ok: false, error: { name: 'IntakeIncompleteError', message: 'x', missing: ['court'] } }));
    const e = await new GasServerGateway(run).finishIngestion({} as never).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RemoteError);
    expect((e as RemoteError).remoteName).toBe('IntakeIncompleteError');
    expect((e as RemoteError).details.missing).toEqual(['court']);
  });

  it('rejects on transport failures (quota, timeout)', async () => {
    const { run } = fakeRun(() => new Error('Exceeded maximum execution time'));
    await expect(new GasServerGateway(run).loadCase()).rejects.toThrow('Exceeded maximum execution time');
  });
});
