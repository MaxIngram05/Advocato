import type { Lang } from '../model';

const FR_WORDS = new Set([
  'bonjour', 'salut', 'allo', 'oui', 'non', 'merci', 'je', 'tu', 'il', 'elle', 'nous', 'vous',
  'ils', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'est', 'sont', 'que', 'qui',
  'pour', 'dans', 'avec', 'sur', 'pas', 'mon', 'ma', 'mes', 'ce', 'cette', 'au', 'aux', 'était',
  'savait', 'veux', 'représente', 'dossier', 'vendeur', 'acheteur', 'vice', 'caché', 'avocat',
]);

const EN_WORDS = new Set([
  'hi', 'hello', 'hey', 'yes', 'no', 'thanks', 'thank', 'i', 'you', 'he', 'she', 'we', 'they',
  'the', 'a', 'an', 'and', 'is', 'are', 'was', 'that', 'which', 'who', 'for', 'in', 'with', 'on',
  'not', 'my', 'this', 'of', 'to', 'knew', 'want', 'represent', 'case', 'seller', 'buyer',
  'defect', 'latent', 'lawyer',
]);

const FR_LETTERS = /[àâçéèêëîïôûùüÿœæ]/gi;

/** US-01: guesses the language of a user message; `undefined` when there is no signal. */
export function detectLanguage(text: string): Lang | undefined {
  const words = text.toLowerCase().match(/[\p{L}’']+/gu) ?? [];
  let fr = (text.match(FR_LETTERS) ?? []).length * 0.5;
  let en = 0;
  for (const raw of words) {
    const w = raw.replace(/^[a-z]’|^[a-z]'/, '');
    if (FR_WORDS.has(w) || /^[ldjmnst][’']/.test(raw)) fr += 1;
    if (EN_WORDS.has(w)) en += 1;
  }
  if (fr === en) return undefined;
  return fr > en ? 'fr' : 'en';
}
