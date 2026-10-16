import { defaultExtractors } from './extraction/defaultExtractors';
import { GasServerGateway, type ScriptRunLike } from './gateway/GasServerGateway';
import type { ServerGateway } from './gateway/ServerGateway';

declare const google: { script: { run: ScriptRunLike } };

/** UI composition root for the Apps Script sidebar (§9.1). */
export function composeUi(): { gateway: ServerGateway; clock: { now(): Date }; extractors: ReturnType<typeof defaultExtractors> } {
  return { gateway: new GasServerGateway(google.script.run), clock: { now: () => new Date() }, extractors: defaultExtractors() };
}
