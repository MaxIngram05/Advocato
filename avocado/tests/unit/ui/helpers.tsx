import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CaseFile, StanceSuggestion } from '../../../src/core/model';
import { App } from '../../../src/ui/App';
import { ExtractorRegistry } from '../../../src/ui/extraction/ExtractorRegistry';
import { PlainTextExtractor } from '../../../src/ui/extraction/PlainTextExtractor';
import { FakeServerGateway } from '../../../src/ui/gateway/FakeServerGateway';

export const fixedClock = { now: () => new Date('2026-10-16T10:00:00.000Z') };

export function renderApp(opts: { initial?: CaseFile | null; suggestion?: StanceSuggestion | null } = {}) {
  const gateway = new FakeServerGateway({ initial: opts.initial ?? null, suggestion: opts.suggestion ?? null });
  const extractors = new ExtractorRegistry([new PlainTextExtractor()], { maxBytes: 25 * 1024 * 1024 });
  const user = userEvent.setup();
  const utils = render(<App gateway={gateway} clock={fixedClock} extractors={extractors} saveDelayMs={0} />);
  return { ...utils, user, gateway };
}
