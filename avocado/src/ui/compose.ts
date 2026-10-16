import { defaultExtractors } from './extraction/defaultExtractors';
import { FakeServerGateway } from './gateway/FakeServerGateway';
import type { ServerGateway } from './gateway/ServerGateway';

/** UI composition root. The Apps Script gateway replaces the fake once the server RPCs exist. */
export function composeUi(): { gateway: ServerGateway; clock: { now(): Date }; extractors: ReturnType<typeof defaultExtractors> } {
  return { gateway: new FakeServerGateway(), clock: { now: () => new Date() }, extractors: defaultExtractors() };
}
