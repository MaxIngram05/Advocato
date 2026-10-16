import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildServer } from '../../../scripts/build-server';

describe('M0 server bundle', () => {
  it('exposes the Apps Script entry points as top-level functions', async () => {
    const outfile = join(mkdtempSync(join(tmpdir(), 'avocado-')), 'Code.js');
    await buildServer({ outfile });
    const code = readFileSync(outfile, 'utf8');
    const context: Record<string, unknown> = {};
    vm.createContext(context);
    vm.runInContext(code, context);
    for (const name of ['onOpen', 'onInstall', 'showSidebar']) {
      expect({ name, type: typeof context[name] }).toEqual({ name, type: 'function' });
      // Apps Script only lists real function declarations in triggers/menus.
      expect(code).toMatch(new RegExp(`^function ${name}[(]`, 'm'));
    }
  }, 30_000);
});
