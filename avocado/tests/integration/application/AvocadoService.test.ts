import { describe, expect, it } from 'vitest';
import { InMemoryCaseRepository } from '../../../src/adapters/fake/InMemoryCaseRepository';
import { InMemoryDocumentWriter } from '../../../src/adapters/fake/InMemoryDocumentWriter';
import { InMemoryExhibitStore } from '../../../src/adapters/fake/InMemoryExhibitStore';
import { ScriptedLlmClient } from '../../../src/adapters/fake/ScriptedLlmClient';
import { AvocadoService } from '../../../src/application/AvocadoService';
import { analysisCase, buyerStance } from '../../fixtures/cases';

function service(script: ConstructorParameters<typeof ScriptedLlmClient>[0] = {}) {
  let n = 0;
  const repo = new InMemoryCaseRepository();
  const writer = new InMemoryDocumentWriter();
  const svc = new AvocadoService({
    repo,
    exhibits: new InMemoryExhibitStore(),
    llm: new ScriptedLlmClient(script),
    writer,
    ids: { next: (p) => `${p}-${++n}` },
    clock: { now: () => new Date('2026-10-16T10:00:00.000Z') },
    docId: () => 'doc-1',
  });
  return { svc, repo, writer };
}

describe('US-13 AvocadoService (server facade)', () => {
  it('creates a fresh case for a document without one: no stance (G10)', async () => {
    const { svc, repo } = service();
    const c = await svc.loadCase();
    expect(c.docId).toBe('doc-1');
    expect(c.stance).toBeUndefined();
    expect(c.session.step).toBe('GREETING');
    expect(await repo.load('doc-1')).toBeNull();
  });

  it('resumes the saved case of the document', async () => {
    const { svc } = service();
    const c = { ...analysisCase(buyerStance), docId: 'doc-1' };
    await svc.saveCase(c);
    expect(await svc.loadCase()).toEqual(c);
  });

  it('refuses to save a case that belongs to another document', async () => {
    const { svc } = service();
    await expect(svc.saveCase({ ...analysisCase(buyerStance), docId: 'other' })).rejects.toThrow(/document/);
  });

  it('persists the result of every operation', async () => {
    const { svc, repo } = service();
    const c = { ...analysisCase(buyerStance), docId: 'doc-1', exhibits: [] };
    const out = await svc.ingestDocuments(c, [{ name: 'a.txt', mime: 'text/plain', segments: [{ locator: 'para. 1', text: 'A' }] }]);
    expect((await repo.load('doc-1'))?.exhibits).toEqual(out.caseFile.exhibits);
  });

  it('reads the document selection', async () => {
    const { svc, writer } = service();
    writer.selection = 'texte';
    expect(await svc.readSelection()).toBe('texte');
  });
});
