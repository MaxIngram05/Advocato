// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

// TODO(MVP): rewrite for the conversational UI.
describe.skip('US-01 greeting & language', () => {
  it('greets with "Bonjour, hi" and shows a FR/EN toggle', async () => {
    renderApp();
    expect(await screen.findByText('Bonjour, hi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('switches the UI to English when the first reply is in English', async () => {
    const { user } = renderApp();
    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'Hello, I need help with a case');
    await user.click(screen.getByRole('button', { name: /send|envoyer/i }));
    expect(await screen.findByRole('heading', { name: 'Case intake' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the UI to French when the first reply is in French', async () => {
    const { user } = renderApp();
    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'Bonjour, j’ai besoin d’aide');
    await user.click(screen.getByRole('button', { name: /send|envoyer/i }));
    expect(await screen.findByRole('heading', { name: 'Ouverture du dossier' })).toBeInTheDocument();
  });

  it('the toggle always overrides the detector', async () => {
    const { user } = renderApp();
    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'Hello there');
    await user.click(screen.getByRole('button', { name: /send|envoyer/i }));
    await screen.findByRole('heading', { name: 'Case intake' });
    await user.click(screen.getByRole('button', { name: 'FR' }));
    expect(await screen.findByRole('heading', { name: 'Ouverture du dossier' })).toBeInTheDocument();
  });

  it('the toggle in the greeting sets the language and starts intake', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'EN' }));
    expect(await screen.findByRole('heading', { name: 'Case intake' })).toBeInTheDocument();
  });

  it('keeps asking when the language cannot be detected', async () => {
    const { user } = renderApp();
    await user.type(await screen.findByRole('textbox', { name: /message/i }), '12345');
    await user.click(screen.getByRole('button', { name: /send|envoyer/i }));
    expect(screen.queryByRole('heading', { name: /intake|dossier/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Français ou English/)).toBeInTheDocument();
  });

  it('saves the language with the case', async () => {
    const { user, gateway } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'EN' }));
    await waitFor(() => expect(gateway.saved.at(-1)?.lang).toBe('en'));
    expect(gateway.saved.at(-1)?.session.lang).toBe('en');
  });
});
