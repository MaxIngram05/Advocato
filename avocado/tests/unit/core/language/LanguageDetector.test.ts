import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../../../../src/core/language/LanguageDetector';

describe('US-01 LanguageDetector', () => {
  it.each([
    ['Bonjour, je représente l’acheteur dans un dossier de vice caché.', 'fr'],
    ['Bonjour', 'fr'],
    ['Oui, merci', 'fr'],
    ['Le vendeur savait que la fondation était fissurée.', 'fr'],
    ['Hi, I represent the buyer in a latent defect case.', 'en'],
    ['Hello', 'en'],
    ['yes thanks', 'en'],
    ['The seller knew that the foundation was cracked.', 'en'],
    ['Je veux poursuivre the seller pour le vice caché', 'fr'],
  ] as const)('%s → %s', (text, lang) => {
    expect(detectLanguage(text)).toBe(lang);
  });

  it.each([[''], ['   '], ['12345'], ['P-1']])('returns undefined when undecidable (%j)', (text) => {
    expect(detectLanguage(text)).toBeUndefined();
  });
});
