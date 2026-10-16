// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

async function startInEnglish() {
  const ctx = renderApp();
  await ctx.user.click(await screen.findByRole('button', { name: 'EN' }));
  await screen.findByRole('heading', { name: 'Case intake' });
  return ctx;
}

async function confirmStance(user: Awaited<ReturnType<typeof startInEnglish>>['user'], role: RegExp) {
  await user.click(screen.getByRole('radio', { name: role }));
  await user.type(screen.getByLabelText('Client name'), 'Client A');
  await user.type(screen.getByLabelText(/Opposing parties/), 'Party B');
  await user.click(screen.getByRole('button', { name: 'Confirm role' }));
}

async function fillRest(user: Awaited<ReturnType<typeof startInEnglish>>['user']) {
  await user.selectOptions(screen.getByLabelText('Court'), 'cq-civil');
  await user.selectOptions(screen.getByLabelText('Area of law'), 'civil');
  await user.type(screen.getByLabelText('Date of facts'), '2025-10-09');
  const party = within(screen.getByRole('group', { name: 'Parties' }));
  await user.type(party.getByLabelText('Name'), 'Client A');
  await user.type(party.getByLabelText('Role'), 'buyer');
}

// TODO(MVP): rewrite for the conversational intake (chips + confirm).
describe.skip('US-02 intake', () => {
  it('shows the stance choice with no preselected option (G10)', async () => {
    await startInEnglish();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const r of radios) expect(r).not.toBeChecked();
  });

  it('offers no objective until the stance is confirmed', async () => {
    await startInEnglish();
    const objective = screen.getByLabelText('Outcome sought');
    expect(objective).toBeDisabled();
  });

  it('computes the objective options from the confirmed stance', async () => {
    const { user } = await startInEnglish();
    await confirmStance(user, /Claimant/);
    const objective = screen.getByLabelText('Outcome sought');
    expect(objective).toBeEnabled();
    const labels = within(objective).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['—', 'Annulment of the sale', 'Price reduction', 'Damages', 'Other']);
  });

  it('defendant stance gets defendant objectives', async () => {
    const { user } = await startInEnglish();
    await confirmStance(user, /Defendant/);
    const labels = within(screen.getByLabelText('Outcome sought'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toContain('Dismissal of the claim');
  });

  it('requires a description for the "other" role', async () => {
    const { user } = await startInEnglish();
    await user.click(screen.getByRole('radio', { name: /Other/ }));
    await user.type(screen.getByLabelText('Client name'), 'Client A');
    await user.click(screen.getByRole('button', { name: 'Confirm role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/describe the role/i);
    expect(screen.getByLabelText('Outcome sought')).toBeDisabled();
  });

  it('asks at most 3 specific questions when fields are missing', async () => {
    const { user } = await startInEnglish();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const thread = screen.getByRole('log');
    const last = [...thread.querySelectorAll('[data-message]')].at(-1);
    expect(last?.querySelectorAll('li')).toHaveLength(3);
    expect(last).toHaveTextContent(/court/i);
    expect(screen.getByRole('heading', { name: 'Case intake' })).toBeInTheDocument();
  });

  it('moves to document upload when intake is complete and saves the case', async () => {
    const { user, gateway } = await startInEnglish();
    await confirmStance(user, /Claimant/);
    await fillRest(user);
    await user.selectOptions(screen.getByLabelText('Outcome sought'), 'reduction');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    await waitFor(() => expect(gateway.saved.at(-1)?.session.step).toBe('UPLOAD'));
    const saved = gateway.saved.at(-1);
    expect(saved?.stance?.role).toBe('claimant');
    expect(saved?.stance?.confirmedAt).toBe('2026-10-16T10:00:00.000Z');
    expect(saved?.court).toBe('Cour du Québec, chambre civile');
    expect(saved?.objective).toBe('reduction');
    expect(saved?.parties).toEqual([{ name: 'Client A', role: 'buyer' }]);
  });

  it('shows a stance suggestion with its evidence but never applies it without a click', async () => {
    const { user, gateway } = renderApp({
      suggestion: {
        role: 'claimant',
        clientName: 'Client A',
        evidence: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: 'Client A, buyer' }],
        confidence: 0.8,
      },
    });
    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'Hello, I act for Client A');
    await user.click(screen.getByRole('button', { name: /send|envoyer/i }));
    const suggestion = await screen.findByRole('region', { name: 'Suggested role' });
    expect(suggestion).toHaveTextContent('P-1 p. 1');
    for (const r of screen.getAllByRole('radio')) expect(r).not.toBeChecked();
    expect(gateway.saved.every((c) => c.stance === undefined)).toBe(true);
    await user.click(within(suggestion).getByRole('button', { name: 'Use this suggestion' }));
    expect(screen.getByRole('radio', { name: /Claimant/ })).toBeChecked();
    expect(screen.getByLabelText('Client name')).toHaveValue('Client A');
    // Still requires the explicit confirmation click.
    expect(screen.getByLabelText('Outcome sought')).toBeDisabled();
  });
});
