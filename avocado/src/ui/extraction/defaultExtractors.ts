import { DocxTextExtractor } from './DocxTextExtractor';
import { ExtractorRegistry } from './ExtractorRegistry';
import { PdfTextExtractor, type PdfjsLike } from './PdfTextExtractor';
import { PlainTextExtractor } from './PlainTextExtractor';

/** 25 MB: Augure's file limit, so a scanned PDF can still be sent for OCR (§10.2). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Browser build of pdfjs-dist. The sidebar is one inlined HTML file served from a
 * sandboxed origin, so instead of a separate worker file we load the worker module on
 * the main thread (pdfjs picks up `globalThis.pdfjsWorker`). See D10.
 */
async function loadBrowserPdfjs(): Promise<PdfjsLike> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs')]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  return pdfjs as unknown as PdfjsLike;
}

export function defaultExtractors(): ExtractorRegistry {
  return new ExtractorRegistry(
    [new PdfTextExtractor(loadBrowserPdfjs), new DocxTextExtractor(), new PlainTextExtractor()],
    { maxBytes: MAX_UPLOAD_BYTES },
  );
}
