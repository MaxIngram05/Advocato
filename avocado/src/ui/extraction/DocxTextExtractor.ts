import mammoth from 'mammoth';
import { segmentParagraphs } from '../../core/exhibits/segments';
import { extensionOf, type ExtractionInput, type ExtractionResult, type TextExtractor } from './ExtractorRegistry';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class DocxTextExtractor implements TextExtractor {
  supports(input: Pick<ExtractionInput, 'name' | 'mime'>): boolean {
    return input.mime === DOCX_MIME || extensionOf(input.name) === 'docx';
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const arrayBuffer = await input.bytes();
    // mammoth's browser build reads `arrayBuffer`; its Node build (tests, scripts) reads `buffer`.
    const NodeBuffer = (globalThis as { Buffer?: { from(a: ArrayBuffer): Buffer } }).Buffer;
    const source = NodeBuffer ? { buffer: NodeBuffer.from(arrayBuffer) } : { arrayBuffer };
    const { value } = await mammoth.extractRawText(source as { arrayBuffer: ArrayBuffer });
    return { ok: true, segments: segmentParagraphs(value) };
  }
}
