import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DocxTextExtractor } from '../../../src/ui/extraction/DocxTextExtractor';
import { ExtractorRegistry, type ExtractionInput } from '../../../src/ui/extraction/ExtractorRegistry';
import { PdfTextExtractor } from '../../../src/ui/extraction/PdfTextExtractor';
import { PlainTextExtractor } from '../../../src/ui/extraction/PlainTextExtractor';
import { makePdf } from '../../helpers/makePdf';

const loadPdfjs = () => import('pdfjs-dist/legacy/build/pdf.mjs');

function input(name: string, mime: string, bytes: Uint8Array): ExtractionInput {
  return {
    name,
    mime,
    size: bytes.byteLength,
    bytes: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const registry = new ExtractorRegistry(
  [new PdfTextExtractor(loadPdfjs), new DocxTextExtractor(), new PlainTextExtractor()],
  { maxBytes: 1024 * 1024 },
);

describe('US-03 text extraction', () => {
  it('extracts plain text into paragraphs (UTF-8)', async () => {
    const r = await registry.extract(input('avis.txt', 'text/plain', utf8('Avis écrit.\n\nDeuxième paragraphe.')));
    expect(r).toEqual({
      ok: true,
      segments: [
        { locator: 'para. 1', text: 'Avis écrit.' },
        { locator: 'para. 2', text: 'Deuxième paragraphe.' },
      ],
    });
  });

  it('recognizes .txt by extension when the MIME type is missing', async () => {
    const r = await registry.extract(input('notes.txt', '', utf8('x')));
    expect(r.ok).toBe(true);
  });

  it('extracts DOCX text with mammoth into paragraphs', async () => {
    const bytes = readFileSync(join(__dirname, '../../fixtures/extraction/sample.docx'));
    const r = await registry.extract(
      input('lettre.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Uint8Array(bytes)),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.segments[0]).toEqual({ locator: 'para. 1', text: 'Lettre de Constructions Rivard inc.' });
    expect(r.segments.map((s) => s.text).join(' ')).toContain('Soumission 2023-058');
  });

  it('extracts PDF text page by page with pdfjs-dist', async () => {
    const r = await registry.extract(input('contrat.pdf', 'application/pdf', makePdf(['Page un', 'Page deux'])));
    expect(r).toEqual({
      ok: true,
      pages: 2,
      segments: [
        { locator: 'p. 1', text: 'Page un' },
        { locator: 'p. 2', text: 'Page deux' },
      ],
    });
  });

  it('flags a PDF without a text layer as "no-text" (scanned)', async () => {
    const r = await registry.extract(input('scan.pdf', 'application/pdf', makePdf([null, null])));
    expect(r).toEqual({ ok: false, reason: 'no-text' });
  });

  it('rejects files that are too large before reading them', async () => {
    const big: ExtractionInput = {
      name: 'gros.pdf',
      mime: 'application/pdf',
      size: 2 * 1024 * 1024,
      bytes: () => Promise.reject(new Error('must not be read')),
    };
    expect(await registry.extract(big)).toEqual({ ok: false, reason: 'too-large' });
  });

  it('rejects unsupported formats', async () => {
    expect(await registry.extract(input('photo.png', 'image/png', new Uint8Array([1])))).toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('reports unreadable files instead of throwing', async () => {
    const r = await registry.extract(input('casse.docx', '', utf8('not a zip')));
    expect(r).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('reports an empty text file as no-text', async () => {
    expect(await registry.extract(input('vide.txt', 'text/plain', utf8('  ')))).toEqual({ ok: false, reason: 'no-text' });
  });
});
