import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InMemoryCaseRepository } from '../../../src/adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../../../src/adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../../../src/adapters/fake/InMemoryExhibitStore';
import { ScriptedLlmClient } from '../../../src/adapters/fake/ScriptedLlmClient';
import { AvocadoService } from '../../../src/application/AvocadoService';
import type { CaseFile, StanceSuggestion } from '../../../src/core/model';
import { InProcessGateway } from '../../../src/dev/InProcessGateway';
import { App } from '../../../src/ui/App';
import { ExtractorRegistry } from '../../../src/ui/extraction/ExtractorRegistry';
import { PlainTextExtractor } from '../../../src/ui/extraction/PlainTextExtractor';
import { FakeServerGateway } from '../../../src/ui/gateway/FakeServerGateway';
import type { ServerGateway } from '../../../src/ui/gateway/ServerGateway';

export const fixedClock = { now: () => new Date('2026-10-16T10:00:00.000Z') };

const extractors = () => new ExtractorRegistry([new PlainTextExtractor()], { maxBytes: 25 * 1024 * 1024 });

function mount(gateway: ServerGateway) {
  const user = userEvent.setup();
  const utils = render(<App gateway={gateway} clock={fixedClock} extractors={extractors()} saveDelayMs={0} />);
  return { ...utils, user };
}

export function renderApp(opts: { initial?: CaseFile | null; suggestion?: StanceSuggestion | null } = {}) {
  const gateway = new FakeServerGateway({ initial: opts.initial ?? null, suggestion: opts.suggestion ?? null });
  return { ...mount(gateway), gateway };
}

/** Renders the sidebar against the real application services, with fake adapters and a scripted LLM. */
export async function renderWithService(opts: {
  initial: CaseFile;
  script?: ConstructorParameters<typeof ScriptedLlmClient>[0];
  exhibitTexts?: Record<string, { locator: string; text: string }[]>;
}) {
  let n = 0;
  const repo = new InMemoryCaseRepository();
  const exhibits = new InMemoryExhibitStore();
  const writer = new InMemoryDocumentWriter();
  const llm = new ScriptedLlmClient(opts.script ?? {});
  const initial: CaseFile = { ...opts.initial, docId: 'doc-1' };
  const withRefs: CaseFile = { ...initial, exhibits: [...initial.exhibits] };
  for (const [exhibitId, segments] of Object.entries(opts.exhibitTexts ?? {})) {
    const textRef = await exhibits.put(initial.id, exhibitId, segments);
    withRefs.exhibits = withRefs.exhibits.map((e) => (e.id === exhibitId ? { ...e, textRef } : e));
  }
  await repo.save(withRefs);
  const service = new AvocadoService({
    repo,
    exhibits,
    llm,
    writer,
    ids: { next: (p) => `${p}-${++n}` },
    clock: fixedClock,
    docId: () => 'doc-1',
  });
  const gateway = new InProcessGateway(service);
  return { ...mount(gateway), repo, llm, writer, service };
}
