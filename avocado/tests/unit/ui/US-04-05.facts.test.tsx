// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CaseFile } from '../../../src/core/model';
import { analysisCase, buyerStance, fact } from '../../fixtures/cases';
import { renderWithService } from './helpers';

function uploadCase(): CaseFile {
  const c = analysisCase(buyerStance, 'en');
  return {
    ...c,
    facts: [],
    exhibits: [{ id: 'P-1', name: 'acte.txt', mime: 'text/plain', textRef: '' }],
    session: { ...c.session, step: 'UPLOAD' },
  };
}

function reviewCase(): CaseFile {
  const c = analysisCase(buyerStance, 'en');
  const facts = [
    fact('F-1', { text: 'The sale was signed.', date: '2025-10-09', status: 'proven', position: 'admitted' }),
    fact('F-2', { text: 'Notice was sent five months after discovery.', date: '2026-03-01', favorability: 'unfavorable', position: 'contested' }),
    fact('F-3', { text: 'The seller knew of prior repairs.', sourceRefs: [], status: 'hypothesis', favorability: 'favorable' }),
    fact('F-0', { text: 'The inspection took place.', date: '2025-09-01', status: 'provided' }),
  ];
  return {
    ...c,
    facts,
    session: { ...c.session, step: 'FACT_REVIEW', allFactIds: facts.map((f) => f.id), factPool: facts.map((f) => f.id) },
  };
}

describe('US-04 fact extraction (UI)', () => {
  it('analyses each exhibit, then shows the timeline checklist', async () => {
    const { user, llm } = await renderWithService({
      initial: uploadCase(),
      exhibitTexts: { 'P-1': [{ locator: 'para. 1', text: 'Sale signed on 9 October 2025.' }] },
      script: {
        extractFacts: [
          {
            facts: [
              {
                text: 'The sale was signed on 9 October 2025.',
                date: '2025-10-09',
                parties: [],
                sourceRefs: [{ exhibitId: 'P-1', locator: 'para. 1', excerpt: 'Sale signed on 9 October 2025.' }],
                status: 'proven',
                position: 'admitted',
                favorability: 'neutral',
              },
            ],
            uncertainties: [],
          },
        ],
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Analyse the exhibits' }));
    const list = await screen.findByRole('group', { name: 'Facts' });
    expect(within(list).getByRole('checkbox', { name: /The sale was signed on 9 October 2025/ })).toBeInTheDocument();
    expect(llm.requests.map((r) => r.task)).toEqual(['extractFacts']);
  });

  it('shows the error and stays on upload when the model fails', async () => {
    const { user } = await renderWithService({
      initial: uploadCase(),
      exhibitTexts: { 'P-1': [{ locator: 'para. 1', text: 'x' }] },
      script: { extractFacts: [new Error('Augure unavailable')] },
    });
    await user.click(await screen.findByRole('button', { name: 'Analyse the exhibits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Augure unavailable');
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
  });

  it('lists facts in timeline order with status, position and favorability labels (G3)', async () => {
    await renderWithService({ initial: reviewCase() });
    const list = await screen.findByRole('group', { name: 'Facts' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('value'))).toEqual(['F-0', 'F-1', 'F-2', 'F-3']);
    const f2 = within(list).getByText(/Notice was sent/).closest('li') as HTMLElement;
    expect(f2).toHaveTextContent('Proven');
    expect(f2).toHaveTextContent('Contested');
    expect(f2).toHaveTextContent('Unfavorable');
    expect(f2).toHaveTextContent('P-1 p. 1');
    const f3 = within(list).getByText(/prior repairs/).closest('li') as HTMLElement;
    expect(f3).toHaveTextContent('Hypothesis');
    expect(f3).toHaveTextContent('No source');
  });
});

describe('US-05 fact selection', () => {
  it('requires at least one fact to continue', async () => {
    await renderWithService({ initial: reviewCase() });
    expect(await screen.findByRole('button', { name: /Continue with 0 selected facts/ })).toBeDisabled();
  });

  it('saves the selection in the case and moves on to analysis', async () => {
    const { user, repo } = await renderWithService({ initial: reviewCase() });
    await user.click(await screen.findByRole('checkbox', { name: /The sale was signed/ }));
    await user.click(screen.getByRole('checkbox', { name: /Notice was sent/ }));
    await user.click(screen.getByRole('button', { name: /Continue with 2 selected facts/ }));
    await waitFor(async () => expect((await repo.load('doc-1'))?.session.selectedFactIds).toEqual(['F-1', 'F-2']));
    expect((await repo.load('doc-1'))?.session.step).toBe('ANALYSING');
  });
});
