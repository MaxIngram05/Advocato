// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { newCaseFile, type CaseFile, type Stance } from '../../../src/core/model';
import { renderApp } from './helpers';

const stance: Stance = {
  role: 'claimant',
  clientName: 'Client A',
  opposingParties: ['Party B'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

function uploadCase(): CaseFile {
  const c = newCaseFile({ id: 'case-1', docId: 'doc-1', lang: 'en' });
  return { ...c, stance, session: { ...c.session, step: 'UPLOAD', lang: 'en', stance } };
}

describe('US-03 document upload', () => {
  it('asks for documents and accepts PDF, DOCX and TXT', async () => {
    renderApp({ initial: uploadCase() });
    const input = await screen.findByLabelText(/Add documents/);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain');
    expect(input).toHaveAttribute('multiple');
  });

  it('extracts the text, numbers the exhibit and lists it', async () => {
    const { user, gateway } = renderApp({ initial: uploadCase() });
    await user.upload(
      await screen.findByLabelText(/Add documents/),
      new File(['Avis écrit.\n\nSuite.'], 'avis.txt', { type: 'text/plain' }),
    );
    const list = await screen.findByRole('list', { name: 'Exhibits' });
    expect(within(list).getByText(/P-1/)).toHaveTextContent('P-1 — avis.txt');
    expect(gateway.ingested[0]).toEqual([
      {
        name: 'avis.txt',
        mime: 'text/plain',
        segments: [
          { locator: 'para. 1', text: 'Avis écrit.' },
          { locator: 'para. 2', text: 'Suite.' },
        ],
      },
    ]);
    await waitFor(() => expect(gateway.saved.at(-1)?.exhibits).toHaveLength(1));
  });

  it('shows an alert and asks for another format when extraction fails', async () => {
    const { user, gateway } = renderApp({ initial: uploadCase() });
    await user.upload(
      await screen.findByLabelText(/Add documents/),
      new File(['   '], 'vide.txt', { type: 'text/plain' }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('vide.txt');
    expect(alert).toHaveTextContent(/another format/i);
    expect(gateway.ingested).toEqual([]);
  });

  it('can paste the current selection of the document as an exhibit', async () => {
    const { user, gateway } = renderApp({ initial: uploadCase() });
    gateway.selection = 'Texte sélectionné dans le document.';
    await user.click(await screen.findByRole('button', { name: 'Use the selected text in the document' }));
    const list = await screen.findByRole('list', { name: 'Exhibits' });
    expect(list).toHaveTextContent('P-1 — Document selection');
  });

  it('warns when nothing is selected in the document', async () => {
    const { user } = renderApp({ initial: uploadCase() });
    await user.click(await screen.findByRole('button', { name: 'Use the selected text in the document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing is selected/i);
  });
});
