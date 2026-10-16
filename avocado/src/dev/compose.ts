import { InMemoryCaseRepository } from '../adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../adapters/fake/InMemoryExhibitStore';
import { ScriptedLlmClient } from '../adapters/fake/ScriptedLlmClient';
import { AvocadoService } from '../application/AvocadoService';
import { defaultExtractors } from '../ui/extraction/defaultExtractors';
import { RemoteError } from '../ui/gateway/GasServerGateway';
import { RpcGateway } from '../ui/gateway/RpcGateway';
import { InProcessGateway } from './InProcessGateway';

/** Dev composition root: live server via /rpc by default, in-browser fakes with `?fake`. */
export function composeDev(params: URLSearchParams) {
  const clock = { now: () => new Date() };
  if (params.has('fake')) {
    let n = 0;
    const service = new AvocadoService({
      repo: new InMemoryCaseRepository(),
      exhibits: new InMemoryExhibitStore(),
      llm: new ScriptedLlmClient({}),
      writer: new InMemoryDocumentWriter(),
      ids: { next: (p) => `${p}-${++n}` },
      clock,
      docId: () => 'dev-doc',
    });
    return { gateway: new InProcessGateway(service), clock, extractors: defaultExtractors() };
  }
  const gateway = new RpcGateway(async (method, args) => {
    const res = await fetch('/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) });
    const reply = (await res.json()) as { ok: true; value: unknown } | { ok: false; error: { name: string; message: string } };
    if (!reply.ok) throw new RemoteError(reply.error);
    return reply.value;
  });
  return { gateway, clock, extractors: defaultExtractors() };
}
