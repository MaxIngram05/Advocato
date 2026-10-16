// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

const css = readFileSync(join(__dirname, '../../../src/ui/theme.css'), 'utf8');

function hex(token: string): string {
  const m = css.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m?.[1]) throw new Error(`token ${token} missing`);
  return m[1];
}

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('US-14 visual identity & accessibility', () => {
  it.each([
    ['av-border', '#11270B'],
    ['av-bg', '#3C5A14'],
    ['av-text', '#FFFBFF'],
    ['av-highlight', '#90AA86'],
    ['av-rollback', '#F2C94C'],
  ])('defines --%s = %s', (token, value) => {
    expect(hex(token).toUpperCase()).toBe(value);
  });

  it.each([
    ['av-text', 'av-bg'],
    ['av-border', 'av-highlight'],
    ['av-border', 'av-rollback'],
    ['av-warn-text', 'av-warn'],
    ['av-critical-text', 'av-critical'],
  ])('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('the message thread is an aria-live polite log', async () => {
    renderApp();
    const log = await screen.findByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it.skip('has no axe violations on the greeting screen', async () => {
    const { container } = renderApp();
    await screen.findByText('Bonjour, hi');
    expect((await axe(container)).violations).toEqual([]);
  });

  it.skip('has no axe violations on the intake screen', async () => {
    const { container, user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'EN' }));
    await screen.findByRole('heading', { name: 'Case intake' });
    expect((await axe(container)).violations).toEqual([]);
  });

  it.skip('is fully keyboard navigable: toggle → message input → send', async () => {
    const { user } = renderApp();
    await screen.findByText('Bonjour, hi');
    await user.tab();
    expect(screen.getByRole('button', { name: 'FR' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'EN' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveFocus();
    await user.keyboard('Hello friend');
    await user.tab();
    expect(screen.getByRole('button', { name: /send|envoyer/i })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Case intake' })).toBeInTheDocument();
  });

  it('shows the step indicator', async () => {
    renderApp();
    expect(await screen.findByRole('navigation', { name: /étape|step/i })).toBeInTheDocument();
  });
});
