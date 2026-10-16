import { mkdirSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL = '__avocado';

/**
 * Bundles src/server/main.ts into one Apps Script file. esbuild's IIFE hides
 * exports behind a global object, so we append a top-level `function name()`
 * stub per export: Apps Script only sees declared functions as entry points.
 */
export async function buildServer(opts: { outfile: string }): Promise<void> {
  mkdirSync(dirname(opts.outfile), { recursive: true });
  await build({
    entryPoints: [resolve(root, 'src/server/main.ts')],
    bundle: true,
    format: 'iife',
    globalName: GLOBAL,
    target: 'es2020',
    platform: 'neutral',
    outfile: opts.outfile,
    logLevel: 'silent',
  });
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(opts.outfile, 'utf8'), context);
  const exported = Object.keys(context[GLOBAL] as Record<string, unknown>);
  const stubs = exported
    .map((name) => `function ${name}() { return ${GLOBAL}.${name}.apply(this, arguments); }`)
    .join('\n');
  appendFileSync(opts.outfile, `\n${stubs}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildServer({ outfile: resolve(root, 'dist/Code.js') });
}
