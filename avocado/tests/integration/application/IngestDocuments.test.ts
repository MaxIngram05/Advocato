import { describe, expect, it } from 'vitest';
import { InMemoryExhibitStore } from '../../../src/adapters/fake/InMemoryExhibitStore';
import { IngestDocuments } from '../../../src/application/IngestDocuments';
import { StanceNotConfirmedError } from '../../../src/core/errors';
import { newCaseFile, type CaseFile, type Stance } from '../../../src/core/model';

const stance: Stance = {
  role: 'claimant',
  clientName: 'A',
  opposingParties: ['B'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

function caseWithStance(): CaseFile {
  const c = newCaseFile({ id: 'case-1', docId: 'doc-1', lang: 'fr' });
  return { ...c, stance, session: { ...c.session, stance, step: 'UPLOAD' } };
}

let seq = 0;
const ids = { next: (p: string) => `${p}-${++seq}` };

describe('US-03 IngestDocuments', () => {
  it('numbers exhibits, stores their text and records them on the case', async () => {
    const store = new InMemoryExhibitStore();
    const out = await new IngestDocuments(store, ids).execute(caseWithStance(), [
      { name: 'contrat.pdf', mime: 'application/pdf', segments: [{ locator: 'p. 1', text: 'Vente' }], pages: 1 },
      { name: 'courriel.txt', mime: 'text/plain', segments: [{ locator: 'para. 1', text: 'Avis' }] },
    ]);
    expect(out.caseFile.exhibits.map((e) => [e.id, e.name])).toEqual([
      ['P-1', 'contrat.pdf'],
      ['P-2', 'courriel.txt'],
    ]);
    expect(out.caseFile.exhibits[0]?.pages).toBe(1);
    expect(await store.get(out.caseFile.exhibits[1]?.textRef ?? '')).toEqual([{ locator: 'para. 1', text: 'Avis' }]);
    expect(out.alerts).toEqual([]);
  });

  it('continues numbering across uploads', async () => {
    const store = new InMemoryExhibitStore();
    const use = new IngestDocuments(store, ids);
    const first = await use.execute(caseWithStance(), [
      { name: 'a.txt', mime: 'text/plain', segments: [{ locator: 'para. 1', text: 'A' }] },
    ]);
    const second = await use.execute(first.caseFile, [
      { name: 'b.txt', mime: 'text/plain', segments: [{ locator: 'para. 1', text: 'B' }] },
    ]);
    expect(second.caseFile.exhibits.map((e) => e.id)).toEqual(['P-1', 'P-2']);
  });

  it('marks OCR exhibits and raises an info alert asking for a spot-check (§10.2)', async () => {
    const out = await new IngestDocuments(new InMemoryExhibitStore(), ids).execute(caseWithStance(), [
      { name: 'scan.pdf', mime: 'application/pdf', segments: [{ locator: 'p. 1', text: 'texte' }], ocr: true },
    ]);
    expect(out.caseFile.exhibits[0]?.ocr).toBe(true);
    expect(out.alerts).toEqual([
      expect.objectContaining({ severity: 'info', target: { kind: 'element', id: 'P-1' } }),
    ]);
    expect(out.caseFile.alerts).toHaveLength(1);
  });

  it('refuses documents with no text and raises a warning asking for another format', async () => {
    const out = await new IngestDocuments(new InMemoryExhibitStore(), ids).execute(caseWithStance(), [
      { name: 'vide.pdf', mime: 'application/pdf', segments: [] },
    ]);
    expect(out.caseFile.exhibits).toEqual([]);
    expect(out.alerts[0]).toEqual(expect.objectContaining({ severity: 'warning' }));
    expect(out.alerts[0]?.message).toContain('vide.pdf');
  });

  it('throws StanceNotConfirmedError without a confirmed stance (G10)', async () => {
    const c = newCaseFile({ id: 'case-1', docId: 'doc-1', lang: 'fr' });
    await expect(new IngestDocuments(new InMemoryExhibitStore(), ids).execute(c, [])).rejects.toBeInstanceOf(
      StanceNotConfirmedError,
    );
  });
});
