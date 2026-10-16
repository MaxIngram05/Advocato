import { segmentParagraphs } from '../../core/exhibits/segments';
import { extensionOf, type ExtractionInput, type ExtractionResult, type TextExtractor } from './ExtractorRegistry';

export class PlainTextExtractor implements TextExtractor {
  supports(input: Pick<ExtractionInput, 'name' | 'mime'>): boolean {
    return input.mime === 'text/plain' || extensionOf(input.name) === 'txt';
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const text = new TextDecoder('utf-8').decode(await input.bytes());
    return { ok: true, segments: segmentParagraphs(text) };
  }
}
