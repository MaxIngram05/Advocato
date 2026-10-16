import { FakeServerGateway } from '../ui/gateway/FakeServerGateway';

/** Dev composition root: the sidebar wired to in-memory fakes (§9.1). */
export function composeDev(_params: URLSearchParams) {
  return { gateway: new FakeServerGateway(), clock: { now: () => new Date() } };
}
