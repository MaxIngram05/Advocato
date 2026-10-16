import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads `.env.local` (then the environment) for LIVE=1 runs. Returns null when not live. */
export function liveConfig() {
  if (process.env.LIVE !== '1') return null;
  const file = join(__dirname, '../../.env.local');
  const env: Record<string, string | undefined> = { ...process.env };
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m?.[1] && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  }
  const apiKey = env.AUGURE_API_KEY;
  if (!apiKey) throw new Error('LIVE=1 needs AUGURE_API_KEY in .env.local or the environment');
  return {
    augure: {
      apiKey,
      baseUrl: env.AUGURE_BASE_URL ?? 'https://api.augureai.ca/v1',
      model: env.AUGURE_MODEL && env.AUGURE_MODEL !== 'auto' ? env.AUGURE_MODEL : 'ossington-5',
      longContextModel: env.AUGURE_LONG_CONTEXT_MODEL ?? 'rosedale-1',
    },
    caijBaseUrl: env.CAIJ_BASE_URL ?? 'https://hackathon.caij.qc.ca',
  };
}
