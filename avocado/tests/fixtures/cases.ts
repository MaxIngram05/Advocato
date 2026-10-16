import { newCaseFile, type CaseFile, type Fact, type Stance } from '../../src/core/model';

export const buyerStance: Stance = {
  role: 'claimant',
  clientName: 'Acheteur inc.',
  opposingParties: ['Vendeur ltée'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

export const sellerStance: Stance = {
  role: 'defendant',
  clientName: 'Vendeur ltée',
  opposingParties: ['Acheteur inc.'],
  confirmedByUser: true,
  confirmedAt: '2026-10-16T10:00:00.000Z',
};

export const fact = (id: string, patch: Partial<Fact> = {}): Fact => ({
  id,
  text: `Fait ${id}`,
  parties: [],
  sourceRefs: [{ exhibitId: 'P-1', locator: 'p. 1', excerpt: `extrait ${id}` }],
  status: 'proven',
  position: 'unknown',
  favorability: 'neutral',
  ...patch,
});

/** A case ready for analysis, with the given stance (or none). */
export function analysisCase(stance: Stance | undefined, lang: 'fr' | 'en' = 'fr'): CaseFile {
  const c = newCaseFile({ id: 'case-1', docId: 'doc-1', lang });
  return {
    ...c,
    court: 'Cour du Québec, chambre civile',
    areaOfLaw: 'civil',
    dateOfFacts: '2025-10-09',
    objective: stance?.role === 'defendant' ? 'dismissal' : 'reduction',
    causesOfAction: ['COA_LATENT_DEFECT'],
    parties: [
      { name: 'Acheteur inc.', role: 'acheteur' },
      { name: 'Vendeur ltée', role: 'vendeur', isProfessional: false },
    ],
    exhibits: [{ id: 'P-1', name: 'contrat.pdf', mime: 'application/pdf', textRef: 'mem:case-1:P-1' }],
    facts: [fact('F-1'), fact('F-2'), fact('F-3')],
    ...(stance ? { stance } : {}),
    session: { ...c.session, step: 'FACT_REVIEW', lang, ...(stance ? { stance } : {}) },
  };
}
