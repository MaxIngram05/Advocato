import { describe, expect, it } from 'vitest';
import { InMemoryExhibitStore } from '../../../src/adapters/fake/InMemoryExhibitStore';
import { ScriptedLlmClient } from '../../../src/adapters/fake/ScriptedLlmClient';
import { ExtractFacts } from '../../../src/application/ExtractFacts';
import { FinishIngestion, IntakeIncompleteError } from '../../../src/application/FinishIngestion';
import { SuggestStance } from '../../../src/application/SuggestStance';
import { TranscribePdf } from '../../../src/application/TranscribePdf';
import { StanceNotConfirmedError } from '../../../src/core/errors';
import type { CaseFile } from '../../../src/core/model';
import { GroundedGenerator } from '../../../src/llm/GroundedGenerator';
import { PromptBuilder } from '../../../src/llm/PromptBuilder';
import { analysisCase, buyerStance } from '../../fixtures/cases';

let seq = 0;
const ids = { next: (p: string) => `${p}-${++seq}` };
const clock = { now: () => new Date('2026-10-16T10:00:00.000Z') };

async function setup(script: ConstructorParameters<typeof ScriptedLlmClient>[0]) {
  const store = new InMemoryExhibitStore();
  const textRef = await store.put('case-1', 'P-1', [
    { locator: 'p. 1', text: 'Acte de vente signé le 9 octobre 2025. Vente sans garantie légale, aux risques et périls.' },
    { locator: 'p. 2', text: 'Le prix est de 450 000 $.' },
  ]);
  const llm = new ScriptedLlmClient(script);
  const gen = new GroundedGenerator(llm, new PromptBuilder(), ids, clock);
  const base = analysisCase(buyerStance);
  const caseFile: CaseFile = {
    ...base,
    facts: [],
    exhibits: [{ id: 'P-1', name: 'acte.pdf', mime: 'application/pdf', textRef }],
    session: { ...base.session, step: 'UPLOAD' },
  };
  return { store, llm, gen, caseFile };
}

const extracted = (patch: Record<string, unknown> = {}) => ({
  text: 'La vente a été signée le 9 octobre 2025.',
  date: '2025-10-09',
  parties: ['Acheteur inc.', 'Vendeur ltée'],
  sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'Acte de vente signé le 9 octobre 2025.' }],
  status: 'proven',
  position: 'admitted',
  favorability: 'neutral',
  ...patch,
});

describe('US-04 ExtractFacts', () => {
  it('extracts facts from one exhibit, numbers them and marks the exhibit as done', async () => {
    const { store, llm, gen, caseFile } = await setup({
      extractFacts: [
        {
          facts: [
            extracted(),
            extracted({
              text: 'La vente est faite sans garantie légale.',
              date: null,
              favorability: 'unfavorable',
              sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'Vente sans garantie légale' }],
            }),
          ],
          uncertainties: [],
        },
      ],
    });
    const out = await new ExtractFacts(gen, store, ids).execute(caseFile, 'P-1');
    expect(out.caseFile.facts.map((f) => f.id)).toEqual(['F-1', 'F-2']);
    expect(out.caseFile.facts[1]?.date).toBeUndefined();
    expect(out.caseFile.facts[1]?.favorability).toBe('unfavorable');
    expect(out.caseFile.exhibits[0]?.factsExtracted).toBe(true);
    expect(out.caseFile.llmCalls).toHaveLength(0);
    const payload = JSON.parse(llm.requests[0]?.user ?? '{}');
    expect(payload.exhibit.id).toBe('P-1');
    expect(payload.exhibit.segments).toHaveLength(2);
  });

  it('continues fact numbering after existing facts', async () => {
    const { store, gen, caseFile } = await setup({ extractFacts: [{ facts: [extracted()], uncertainties: [] }] });
    const withFacts = { ...caseFile, facts: [{ ...extracted(), id: 'F-7', parties: [] } as CaseFile['facts'][number]] };
    const out = await new ExtractFacts(gen, store, ids).execute(withFacts, 'P-1');
    expect(out.caseFile.facts.map((f) => f.id)).toEqual(['F-7', 'F-8']);
  });

  it('drops excerpts that are not in the exhibit and downgrades the fact to hypothesis with an alert', async () => {
    const { store, gen, caseFile } = await setup({
      extractFacts: [
        {
          facts: [extracted({ sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'Le vendeur a admis le vice.' }] })],
          uncertainties: [],
        },
      ],
    });
    const out = await new ExtractFacts(gen, store, ids).execute(caseFile, 'P-1');
    expect(out.caseFile.facts[0]?.sourceRefs).toEqual([]);
    expect(out.caseFile.facts[0]?.status).toBe('hypothesis');
    expect(out.alerts.map((a) => a.severity)).toContain('warning');
    expect(out.alerts.some((a) => a.message.includes('Le vendeur a admis le vice.'))).toBe(true);
  });

  it('raises alerts for hypothesis/missing facts and model uncertainties (G7)', async () => {
    const { store, gen, caseFile } = await setup({
      extractFacts: [
        {
          facts: [extracted({ status: 'missing', sourceRefs: [], text: 'Rapport d’inspection préachat' })],
          uncertainties: ['La date de découverte du vice est imprécise.'],
        },
      ],
    });
    const out = await new ExtractFacts(gen, store, ids).execute(caseFile, 'P-1');
    expect(out.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', target: { kind: 'fact', id: 'F-1' } }),
        expect.objectContaining({ severity: 'info', message: 'La date de découverte du vice est imprécise.' }),
      ]),
    );
    expect(out.caseFile.alerts).toEqual(expect.arrayContaining(out.alerts));
  });

  it('refuses to run without a confirmed stance (G10)', async () => {
    const { store, gen, caseFile } = await setup({});
    await expect(new ExtractFacts(gen, store, ids).execute({ ...caseFile, stance: undefined }, 'P-1')).rejects.toBeInstanceOf(
      StanceNotConfirmedError,
    );
  });

  it('fails clearly for an unknown exhibit', async () => {
    const { store, gen, caseFile } = await setup({});
    await expect(new ExtractFacts(gen, store, ids).execute(caseFile, 'P-9')).rejects.toThrow(/P-9/);
  });
});

describe('US-04/G9 FinishIngestion', () => {
  it('moves to FACT_REVIEW with every fact in the pool', async () => {
    const { caseFile } = await setup({});
    const ready: CaseFile = {
      ...caseFile,
      exhibits: caseFile.exhibits.map((e) => ({ ...e, factsExtracted: true })),
      facts: analysisCase(buyerStance).facts,
    };
    const out = new FinishIngestion().execute(ready);
    expect(out.caseFile.session.step).toBe('FACT_REVIEW');
    expect(out.caseFile.session.factPool).toEqual(['F-1', 'F-2', 'F-3']);
  });

  it('refuses while exhibits are still being analysed', async () => {
    const { caseFile } = await setup({});
    expect(() => new FinishIngestion().execute(caseFile)).toThrow(/P-1/);
  });

  it('refuses when required intake information is missing (G9)', async () => {
    const { caseFile } = await setup({});
    const incomplete = { ...caseFile, court: '', exhibits: caseFile.exhibits.map((e) => ({ ...e, factsExtracted: true })) };
    const e = (() => {
      try {
        new FinishIngestion().execute(incomplete);
      } catch (x) {
        return x;
      }
    })();
    expect(e).toBeInstanceOf(IntakeIncompleteError);
    expect((e as IntakeIncompleteError).missing).toEqual(['court']);
  });
});

describe('§10.2 TranscribePdf (scanned PDFs)', () => {
  it('sends the PDF as a file part and ingests the transcription as an OCR exhibit', async () => {
    const { store, llm, gen, caseFile } = await setup({
      transcribePdf: [{ pages: [{ page: 1, text: 'Rapport d’inspection' }, { page: 2, text: '' }] }],
    });
    const out = await new TranscribePdf(gen, store, ids).execute(caseFile, { name: 'scan.pdf', base64: 'JVBERi0=' });
    expect(llm.requests[0]?.file).toEqual({ name: 'scan.pdf', mime: 'application/pdf', base64: 'JVBERi0=' });
    const ex = out.caseFile.exhibits.at(-1);
    expect(ex).toEqual(expect.objectContaining({ id: 'P-2', name: 'scan.pdf', ocr: true, pages: 2 }));
    expect(await store.get(ex?.textRef ?? '')).toEqual([{ locator: 'p. 1', text: 'Rapport d’inspection' }]);
    expect(out.alerts).toEqual([expect.objectContaining({ severity: 'info' })]);
  });
});

describe('US-02/G10 SuggestStance', () => {
  it('returns a suggestion with evidence but never sets the stance', async () => {
    const { gen, caseFile } = await setup({
      suggestStance: [
        {
          suggestion: {
            role: 'claimant',
            clientName: 'Acheteur inc.',
            evidence: [{ exhibitId: 'chat', locator: 'message 1', excerpt: 'je représente l’acheteur' }],
            confidence: 0.7,
          },
        },
      ],
    });
    const noStance = { ...caseFile, stance: undefined, session: { ...caseFile.session, stance: undefined, step: 'INTAKE' as const } };
    const out = await new SuggestStance(gen).execute(noStance);
    expect(out?.role).toBe('claimant');
    expect(out?.evidence[0]?.exhibitId).toBe('chat');
  });

  it('returns null when the model has no suggestion', async () => {
    const { gen, caseFile } = await setup({ suggestStance: [{ suggestion: null }] });
    expect(await new SuggestStance(gen).execute({ ...caseFile, stance: undefined })).toBeNull();
  });

  it('does not ask again once the stance is confirmed', async () => {
    const { gen, llm, caseFile } = await setup({});
    expect(await new SuggestStance(gen).execute(caseFile)).toBeNull();
    expect(llm.requests).toHaveLength(0);
  });
});
