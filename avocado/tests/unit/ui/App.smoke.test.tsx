// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderApp } from './helpers';

describe.skip('M0 smoke', () => {
  it('renders the Avocado sidebar shell', async () => {
    renderApp();
    expect(await screen.findByRole('banner')).toHaveTextContent('Avocado');
  });
});
