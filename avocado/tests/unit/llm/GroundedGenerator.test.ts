import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ScriptedLlmClient } from '../../../src/adapters/fake/ScriptedLlmClient';
import { StanceNotConfirmedError } from '../../../src/core/errors';
import { LlmOutputInvalidError } from '../../../src/llm/errors';
import { GroundedGenerator } from '../../../src/llm/GroundedGenerator';
import { PromptBuilder } from '../../../src/llm/PromptBuilder';
import { analysisCase, buyerStance, fact } from '../../fixtures/cases';

const RowsSchema = z.object({
  rows: z.array(z.object({ text: z.string(), citationIds: z.array(z.string()), factIds: z.array(z.string()) })),
});

let n = 0;
const ids = { next: (p: string) => `${p}-${++n}` };
const clock = { now: () => new Date('2026-10-16T10:00:00.000Z') };
const sources = [{ id: 'S-1', title: 'art 1726 CcQ', pinpoints: ['art 1726'], excerpt: '…' }];

function generator(llm: ScriptedLlmClient) {
  return new GroundedGenerator(llm, new PromptBuilder(), ids, clock);
}

const request = {
  task: 'buildMatrixRows' as const,
  caseFile: analysisCase(buyerStance),
  schema: RowsSchema,
  allowedSources: sources,
  facts: [fact('F-1')],
  payload: {},
};

describe('§14.3 validation loop', () => {
  it('returns a valid, grounded answer on the first try', async () => {
    const llm = new ScriptedLlmClient({ buildMatrixRows: [{ rows: [{ text: 'ok', citationIds: ['S-1'], factIds: ['F-1'] }] }] });
    const out = await generator(llm).run(request);
    expect(out.value.rows[0]?.text).toBe('ok');
    expect(out.alerts).toEqual([]);
    expect(llm.requests).toHaveLength(1);
    expect(llm.requests[0]?.allowedSourceIds).toEqual(['S-1']);
  });

  it('retries once with the schema errors appended, then succeeds', async () => {
    const llm = new ScriptedLlmClient({
      buildMatrixRows: [{ rows: [{ text: 1 }] }, { rows: [{ text: 'fixed', citationIds: [], factIds: [] }] }],
    });
    const out = await generator(llm).run(request);
    expect(out.value.rows[0]?.text).toBe('fixed');
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1]?.user).toMatch(/rows\.0\.text/);
  });

  it('throws after a second schema failure (cannot downgrade unparseable output)', async () => {
    const llm = new ScriptedLlmClient({ buildMatrixRows: [{ bad: true }, { still: 'bad' }] });
    await expect(generator(llm).run(request)).rejects.toBeInstanceOf(LlmOutputInvalidError);
    expect(llm.requests).toHaveLength(2);
  });

  it('G8: an invented citation is rejected and retried once with the grounding errors', async () => {
    const llm = new ScriptedLlmClient({
      buildMatrixRows: [
        { rows: [{ text: 'a', citationIds: ['ABB-2007'], factIds: [] }] },
        { rows: [{ text: 'b', citationIds: ['S-1'], factIds: [] }] },
      ],
    });
    const out = await generator(llm).run(request);
    expect(out.value.rows[0]?.citationIds).toEqual(['S-1']);
    expect(llm.requests[1]?.user).toContain('ABB-2007');
  });

  it('G1/G8: a second invented citation is downgraded (removed + listed) and raises a warning alert', async () => {
    const bad = { rows: [{ text: 'a', citationIds: ['ABB-2007', 'S-1'], factIds: ['F-999'] }] };
    const llm = new ScriptedLlmClient({ buildMatrixRows: [bad, bad] });
    const out = await generator(llm).run(request);
    expect(out.value.rows[0]?.citationIds).toEqual(['S-1']);
    expect(out.value.rows[0]?.factIds).toEqual([]);
    expect(out.downgraded.map((d) => d.id)).toEqual(['ABB-2007', 'F-999']);
    expect(out.alerts).toEqual([
      expect.objectContaining({ severity: 'warning', message: expect.stringContaining('ABB-2007') }),
    ]);
  });

  it('G10: refuses to call the LLM without a confirmed stance', async () => {
    const llm = new ScriptedLlmClient({});
    await expect(generator(llm).run({ ...request, caseFile: analysisCase(undefined) })).rejects.toBeInstanceOf(
      StanceNotConfirmedError,
    );
    expect(llm.requests).toHaveLength(0);
  });

  it('logs call metadata (never the prompt) and raises an info alert on fallback capacity', async () => {
    const llm = new ScriptedLlmClient(
      { buildMatrixRows: [{ rows: [] }] },
      { model: 'ossington-4-1', requestId: 'req-1', inferenceRegion: 'ca-on-toronto', fallback: true, fallbackReason: 'capacity' },
    );
    const out = await generator(llm).run(request);
    expect(out.calls).toEqual([
      {
        task: 'buildMatrixRows',
        at: '2026-10-16T10:00:00.000Z',
        model: 'ossington-4-1',
        requestId: 'req-1',
        inferenceRegion: 'ca-on-toronto',
        fallback: true,
        fallbackReason: 'capacity',
      },
    ]);
    expect(JSON.stringify(out.calls)).not.toContain('legal research assistant');
    expect(out.alerts).toEqual([expect.objectContaining({ severity: 'info', message: expect.stringContaining('ca-on-toronto') })]);
  });

  it('checks exhibit references against the case exhibits', async () => {
    const Schema = z.object({ refs: z.array(z.object({ exhibitId: z.string() })) });
    const bad = { refs: [{ exhibitId: 'P-77' }] };
    const llm = new ScriptedLlmClient({ extractFacts: [bad, bad] });
    const out = await generator(llm).run({ ...request, task: 'extractFacts', schema: Schema });
    expect(out.downgraded).toEqual([{ path: 'refs[0].exhibitId', kind: 'exhibit', id: 'P-77' }]);
  });
});
