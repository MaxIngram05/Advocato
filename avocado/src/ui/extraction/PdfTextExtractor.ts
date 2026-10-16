import { segmentPages } from '../../core/exhibits/segments';
import { extensionOf, type ExtractionInput, type ExtractionResult, type TextExtractor } from './ExtractorRegistry';

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

/** The slice of pdfjs-dist we use; injected so the browser and Node builds both fit. */
export interface PdfjsLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; disableFontFace?: boolean }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
      destroy(): Promise<void>;
    }>;
  };
}

export class PdfTextExtractor implements TextExtractor {
  constructor(private readonly loadPdfjs: () => Promise<PdfjsLike>) {}

  supports(input: Pick<ExtractionInput, 'name' | 'mime'>): boolean {
    return input.mime === 'application/pdf' || extensionOf(input.name) === 'pdf';
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const pdfjs = await this.loadPdfjs();
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(await input.bytes()),
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    try {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        pages.push(
          (content.items as PdfTextItem[])
            .map((it) => `${it.str ?? ''}${it.hasEOL ? '\n' : ''}`)
            .join('')
            .replace(/[ \t]+/g, ' ')
            .trim(),
        );
      }
      const segments = segmentPages(pages);
      if (segments.length === 0) return { ok: false, reason: 'no-text' };
      return { ok: true, segments, pages: doc.numPages };
    } finally {
      await doc.destroy();
    }
  }
}
