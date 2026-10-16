import type { AvocadoService } from '../application/AvocadoService';
import { handleRpc } from '../server/rpc';
import { RemoteError } from '../ui/gateway/GasServerGateway';
import { RpcGateway } from '../ui/gateway/RpcGateway';

/**
 * Dev/test gateway: calls the real application service in the same process, through the
 * same JSON RPC dispatcher the Apps Script server uses.
 */
export class InProcessGateway extends RpcGateway {
  constructor(service: AvocadoService) {
    super(async (method, argsJson) => {
      const reply = JSON.parse(await handleRpc(service, method, argsJson)) as
        | { ok: true; value: unknown }
        | { ok: false; error: { name: string; message: string } & Record<string, unknown> };
      if (!reply.ok) throw new RemoteError(reply.error);
      return reply.value;
    });
  }
}
