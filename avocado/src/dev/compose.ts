import { InMemoryCaseRepository } from '../adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../adapters/fake/InMemoryExhibitStore';
import { ScriptedLlmClient } from '../adapters/fake/ScriptedLlmClient';
import { AvocadoService } from '../application/AvocadoService';
import { defaultExtractors } from '../ui/extraction/defaultExtractors';
import { InProcessGateway } from './InProcessGateway';

/** Dev composition root: the real application services wired to in-memory fakes (§9.1). */
export function composeDev(_params: URLSearchParams) {
  let n = 0;
  const clock = { now: () => new Date() };
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
