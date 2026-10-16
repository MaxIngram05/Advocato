import type { Lang } from './model';

/** Picks the user-facing text for the case language (every server message exists in both). */
export const tr = (lang: Lang, fr: string, en: string): string => (lang === 'fr' ? fr : en);
