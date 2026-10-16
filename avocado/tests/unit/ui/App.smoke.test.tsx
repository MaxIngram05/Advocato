// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { App } from '../../../src/ui/App';

describe('M0 smoke', () => {
  it('renders the Avocado sidebar shell', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('Avocado');
  });
});
