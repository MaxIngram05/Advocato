import { describe, expect, it } from 'vitest';
import type { ExhibitStore } from '../../src/ports';

export function exhibitStoreContract(name: string, make: () => ExhibitStore) {
  describe(`US-03 ExhibitStore contract: ${name}`, () => {
    const segments = [
      { locator: 'p. 1', text: 'Première page — accents éàç.' },
      { locator: 'p. 2', text: 'Deuxième page.' },
    ];

    it('stores segments and returns a reference that reads them back', async () => {
      const store = make();
      const ref = await store.put('case-1', 'P-1', segments);
      expect(typeof ref).toBe('string');
      expect(await store.get(ref)).toEqual(segments);
    });

    it('returns null for an unknown reference', async () => {
      expect(await make().get('nope')).toBeNull();
    });

    it('gives distinct references to distinct exhibits', async () => {
      const store = make();
      const a = await store.put('case-1', 'P-1', segments);
      const b = await store.put('case-1', 'P-2', [{ locator: 'para. 1', text: 'B' }]);
      expect(a).not.toBe(b);
      expect(await store.get(b)).toEqual([{ locator: 'para. 1', text: 'B' }]);
    });
  });
}
