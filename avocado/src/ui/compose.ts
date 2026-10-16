import { FakeServerGateway } from './gateway/FakeServerGateway';
import type { ServerGateway } from './gateway/ServerGateway';

/** UI composition root. The Apps Script gateway replaces the fake in M3. */
export function composeUi(): { gateway: ServerGateway; clock: { now(): Date } } {
  return { gateway: new FakeServerGateway(), clock: { now: () => new Date() } };
}
