import type { ExhibitSegment } from '../../ports';

export interface ExtractionInput {
  name: string;
  mime: string;
  size: number;
  bytes(): Promise<ArrayBuffer>;
}

export type ExtractionFailure = 'no-text' | 'too-large' | 'unsupported' | 'unreadable';

export type ExtractionResult =
  | { ok: true; segments: ExhibitSegment[]; pages?: number }
  | { ok: false; reason: ExtractionFailure };

/** US-03: one implementation per format; new formats are added, not edited in (Open/Closed). */
export interface TextExtractor {
  supports(input: Pick<ExtractionInput, 'name' | 'mime'>): boolean;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

export class ExtractorRegistry {
  constructor(
    private readonly extractors: TextExtractor[],
    private readonly opts: { maxBytes: number },
  ) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const extractor = this.extractors.find((e) => e.supports(input));
    if (!extractor) return { ok: false, reason: 'unsupported' };
    if (input.size > this.opts.maxBytes) return { ok: false, reason: 'too-large' };
    try {
      const result = await extractor.extract(input);
      return result.ok && result.segments.length === 0 ? { ok: false, reason: 'no-text' } : result;
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }
}
