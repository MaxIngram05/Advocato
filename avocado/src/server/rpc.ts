import type { AvocadoService } from '../application/AvocadoService';

/** Methods reachable from the sidebar. Anything else is refused. */
export const RPC_METHODS = [
  'loadCase',
  'saveCase',
  'suggestStance',
  'ingestDocuments',
  'transcribePdf',
  'extractFacts',
  'finishIngestion',
  'readSelection',
  'analyseCase',
] as const satisfies readonly (keyof AvocadoService)[];

export type RpcMethod = (typeof RPC_METHODS)[number];

type RpcReply = { ok: true; value: unknown } | { ok: false; error: { name: string; message: string } & Record<string, unknown> };

function serializeError(e: unknown): RpcReply {
  if (e instanceof Error) {
    const { name, message, stack: _stack, ...fields } = e as Error & Record<string, unknown>;
    const extras = Object.fromEntries(Object.entries(fields).filter(([, v]) => v === null || typeof v !== 'function'));
    return { ok: false, error: { ...extras, name, message } };
  }
  return { ok: false, error: { name: 'Error', message: String(e) } };
}

/**
 * The single server entry point behind `google.script.run.avocadoRpc(method, argsJson)`.
 * Arguments and results travel as JSON strings, so nothing depends on GAS serialization rules.
 */
export async function handleRpc(service: AvocadoService, method: string, argsJson: string): Promise<string> {
  let reply: RpcReply;
  try {
    if (!(RPC_METHODS as readonly string[]).includes(method)) {
      throw Object.assign(new Error(`Unknown RPC method: ${method}`), { name: 'RpcError' });
    }
    const args = JSON.parse(argsJson) as unknown[];
    const fn = (service as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
    if (typeof fn !== 'function') throw Object.assign(new Error(`Unknown RPC method: ${method}`), { name: 'RpcError' });
    reply = { ok: true, value: (await fn.apply(service, args)) ?? null };
  } catch (e) {
    reply = serializeError(e);
  }
  return JSON.stringify(reply);
}
