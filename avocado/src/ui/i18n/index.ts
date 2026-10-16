import { createContext, useContext } from 'react';
import type { Lang } from '../../core/model';
import en from './en.json';
import fr from './fr.json';

const dictionaries: Record<Lang, Record<string, unknown>> = { fr, en };

/** Looks up a dotted key; returns the key itself when missing so gaps are visible. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dictionaries[lang]);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export const LangContext = createContext<Lang>('fr');

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const lang = useContext(LangContext);
  return (key, vars) => t(lang, key, vars);
}
