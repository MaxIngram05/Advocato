import { describe, expect, it } from 'vitest';
import { StanceNotConfirmedError } from '../../../src/core/errors';
import { PromptBuilder, roleVariables } from '../../../src/llm/PromptBuilder';
import { PROMPT_TEMPLATES } from '../../../src/llm/prompts';
import { analysisCase, buyerStance, fact, sellerStance } from '../../fixtures/cases';

const sources = [{ id: 'S-1', title: 'art 1726 CcQ', pinpoints: ['art 1726'], excerpt: 'Le vendeur est tenu…' }];

describe('§14.2 PromptBuilder (G1, G8, G10)', () => {
  it('prepends the Legal Reasoning Charter with the case context and confirmed perspective', () => {
    const { system } = new PromptBuilder().build({
      task: 'extractFacts',
      caseFile: analysisCase(buyerStance, 'en'),
      allowedSources: sources,
      facts: [fact('F-1')],
      payload: { exhibits: [] },
    });
    expect(system).toContain('You are a legal research assistant supporting a member of the Québec bar.');
    expect(system).toContain('court=Cour du Québec, chambre civile; area of law=civil');
    expect(system).toContain('date of facts=2025-10-09');
    expect(system).toContain('cause(s) of action=COA_LATENT_DEFECT');
    expect(system).toContain('you act for Acheteur inc., who is the claimant; the opposing party is Vendeur ltée');
    expect(system).toContain('"Favorable" and "unfavorable" are always relative to Acheteur inc.');
    expect(system).toContain('1. Cite ONLY sources whose id appears in ALLOWED_SOURCES below.');
    expect(system).toContain('Write all prose fields in English.');
    expect(system).toContain('ALLOWED_SOURCES: [{"id":"S-1"');
    expect(system).toContain('CASE FACTS: [{"id":"F-1"');
  });

  it('writes the charter in French for a French case', () => {
    const { system } = new PromptBuilder().build({
      task: 'extractFacts',
      caseFile: analysisCase(sellerStance, 'fr'),
      allowedSources: [],
      facts: [],
      payload: {},
    });
    expect(system).toContain('Vous êtes un assistant de recherche juridique');
    expect(system).toContain('vous agissez pour Vendeur ltée, qui est le défendeur');
    expect(system).toContain('Rédigez tous les champs de texte en français.');
  });

  it('uses the role description for an "other" stance', () => {
    const vars = roleVariables(
      { ...buyerStance, role: 'other', roleDescription: 'mis en cause' },
      'fr',
    );
    expect(vars.clientRole).toBe('mis en cause');
  });

  it('refuses to build any prompt without a confirmed stance (G10)', () => {
    expect(() =>
      new PromptBuilder().build({ task: 'extractFacts', caseFile: analysisCase(undefined), allowedSources: [], facts: [], payload: {} }),
    ).toThrow(StanceNotConfirmedError);
  });

  it('puts the task payload and any validation errors in the user message', () => {
    const { user } = new PromptBuilder().build({
      task: 'extractFacts',
      caseFile: analysisCase(buyerStance),
      allowedSources: [],
      facts: [],
      payload: { exhibits: [{ id: 'P-1' }] },
      validationErrors: ['citationIds[0]: "X-9" is not in ALLOWED_SOURCES'],
    });
    expect(user).toContain('"exhibits":[{"id":"P-1"}]');
    expect(user).toContain('X-9');
    expect(user).toMatch(/previous answer was rejected|réponse précédente a été rejetée/i);
  });

  it('every task has a template in both languages', () => {
    for (const template of Object.values(PROMPT_TEMPLATES)) {
      expect(template.instructions.fr.length).toBeGreaterThan(20);
      expect(template.instructions.en.length).toBeGreaterThan(20);
    }
  });

  it('no template hard-codes a side (G10): wording must come from role variables', () => {
    const forbidden = [
      /\bour claim\b/i,
      /\bthe defen[cs]e\b/i,
      /\bthe buyer\b/i,
      /\bthe seller\b/i,
      /\bthe plaintiff\b/i,
      /\bthe claimant\b/i,
      /\bthe defendant\b/i,
      /\bnotre (demande|réclamation|client)\b/i,
      /\bla défense\b/i,
      /\bl[’']acheteur\b/i,
      /\ble vendeur\b/i,
      /\ble demandeur\b/i,
      /\ble défendeur\b/i,
    ];
    const builder = new PromptBuilder();
    for (const [task, template] of Object.entries(PROMPT_TEMPLATES)) {
      for (const lang of ['fr', 'en'] as const) {
        for (const re of forbidden) {
          expect({ task, lang, hit: re.test(template.instructions[lang]) }).toEqual({ task, lang, hit: false });
        }
      }
      // Rendering with placeholder names leaves no side wording outside the variables.
      const placeholder = { ...buyerStance, clientName: '<CLIENT>', opposingParties: ['<OPPONENT>'] };
      const { system } = builder.build({
        task: task as keyof typeof PROMPT_TEMPLATES,
        caseFile: analysisCase(placeholder, 'en'),
        allowedSources: [],
        facts: [],
        payload: {},
      });
      expect(system).toContain('<CLIENT>');
    }
  });
});
