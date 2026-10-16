import { describe, expect, it } from 'vitest';
import { newCaseFile, type CaseFile } from '../../src/core/model';
import type { CaseRepository } from '../../src/ports';

/** §9.1 Liskov: every CaseRepository implementation must pass this suite. */
export function caseRepositoryContract(name: string, make: () => CaseRepository) {
  describe(`US-13 CaseRepository contract: ${name}`, () => {
    const sample = (): CaseFile => ({
      ...newCaseFile({ id: 'case-1', docId: 'doc-1', lang: 'fr' }),
      court: 'Cour supérieure',
      facts: [
        {
          id: 'F-1',
          text: 'La vente a été conclue le 9 octobre 2025 — « accents » inclus.',
          parties: ['A'],
          sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'vente' }],
          status: 'proven',
          position: 'admitted',
          favorability: 'neutral',
        },
      ],
    });

    it('returns null when no case is attached to the document', async () => {
      expect(await make().load('unknown-doc')).toBeNull();
    });

    it('round-trips a case file exactly', async () => {
      const repo = make();
      await repo.save(sample());
      expect(await repo.load('doc-1')).toEqual(sample());
    });

    it('overwrites on subsequent saves (one case per document)', async () => {
      const repo = make();
      await repo.save(sample());
      await repo.save({ ...sample(), court: 'Cour du Québec' });
      expect((await repo.load('doc-1'))?.court).toBe('Cour du Québec');
    });

    it('keeps cases of different documents apart', async () => {
      const repo = make();
      await repo.save(sample());
      await repo.save({ ...sample(), id: 'case-2', docId: 'doc-2' });
      expect((await repo.load('doc-1'))?.id).toBe('case-1');
      expect((await repo.load('doc-2'))?.id).toBe('case-2');
    });

    it('returns an independent copy (no shared mutation)', async () => {
      const repo = make();
      const c = sample();
      await repo.save(c);
      c.court = 'mutated';
      const loaded = await repo.load('doc-1');
      expect(loaded?.court).toBe('Cour supérieure');
    });

    it('large cases (> 9 KB) are supported', async () => {
      const repo = make();
      const big = { ...sample(), opposingArguments: Array.from({ length: 500 }, (_, i) => `argument ${i} `.repeat(5)) };
      await repo.save(big);
      expect((await repo.load('doc-1'))?.opposingArguments).toHaveLength(500);
    });
  });
}
