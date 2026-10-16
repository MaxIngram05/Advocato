import { z } from 'zod';
import { detectLanguage } from '../core/language/LanguageDetector';
import type { CaseFile, Lang } from '../core/model';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import type { DocumentWriter } from '../ports';

const TranslationSchema = z.object({ translations: z.array(z.string()) });

/** Keeps each request small enough for one quick model call. */
const CHUNK_CHARS = 6000;

export interface TranslateResult {
  from: Lang;
  to: Lang;
  paragraphs: number;
}

/**
 * Translates the open document FR ⇄ EN paragraph by paragraph, keeping the document
 * structure (headings, lists, tables). Replaces text in place: the UI asks first.
 */
export class TranslateDocument {
  constructor(
    private readonly llm: GroundedGenerator,
    private readonly writer: DocumentWriter,
  ) {}

  async execute(caseFile: CaseFile): Promise<TranslateResult> {
    const blocks = await this.writer.readTextBlocks();
    const sample = blocks.join(' ').slice(0, 6000);
    const from: Lang = detectLanguage(sample) ?? caseFile.lang;
    const to: Lang = from === 'fr' ? 'en' : 'fr';

    const indices = blocks.map((b, i) => (b.trim() ? i : -1)).filter((i) => i >= 0);
    const chunks: number[][] = [];
    let current: number[] = [];
    let size = 0;
    for (const i of indices) {
      const len = blocks[i]?.length ?? 0;
      if (current.length > 0 && size + len > CHUNK_CHARS) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(i);
      size += len;
    }
    if (current.length > 0) chunks.push(current);

    const translated = [...blocks];
    await Promise.all(
      chunks.map(async (chunk) => {
        const segments = chunk.map((i) => blocks[i] ?? '');
        const out = await this.llm.run({
          task: 'translateDocument',
          caseFile: { ...caseFile, lang: to },
          schema: TranslationSchema,
          allowedSources: [],
          facts: [],
          payload: { targetLanguage: to === 'fr' ? 'French (Québec)' : 'English (Canada)', segments },
        });
        if (out.value.translations.length !== segments.length) {
          throw new Error(`Translation returned ${out.value.translations.length} segments instead of ${segments.length}.`);
        }
        chunk.forEach((i, k) => {
          translated[i] = out.value.translations[k] ?? blocks[i] ?? '';
        });
      }),
    );
    await this.writer.replaceTextBlocks(translated);
    return { from, to, paragraphs: indices.length };
  }
}
