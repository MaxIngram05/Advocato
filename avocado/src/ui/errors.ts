import { RemoteError } from './gateway/GasServerGateway';

/** User-facing text for a failed server call. */
export function describeError(t: (key: string, vars?: Record<string, string | number>) => string, e: unknown): string {
  if (e instanceof RemoteError && e.remoteName === 'IntakeIncompleteError' && Array.isArray(e.details.missing)) {
    return t('errors.intakeIncomplete', { fields: (e.details.missing as string[]).join(', ') });
  }
  return t('errors.generic', { message: e instanceof Error ? e.message : String(e) });
}
