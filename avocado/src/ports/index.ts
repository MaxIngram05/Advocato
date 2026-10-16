import type { ZodType } from 'zod';
import type { CaseFile, ExhibitSegment, Lang } from '../core/model';

export type { ExhibitSegment } from '../core/model';

/** §9.5 ports. Small, segregated interfaces; adapters live in src/adapters. */

export type LlmTask =
  | 'detectMissingInfo'
  | 'suggestStance'
  | 'extractFacts'
  | 'buildMatrixRows'
  | 'assessDamages'
  | 'proposeArguments'
  | 'generateCounterArguments'
  | 'generateRebuttals'
  | 'justifyRemedy'
  | 'analyseUnfavorableEvidence'
  | 'draftDocument'
  | 'proofread'
  | 'findWeaknesses'
  | 'suggestNextPrompts'
  | 'transcribePdf';

export interface LlmRequest<T> {
  task: LlmTask;
  system: string;
  user: string;
  schema: ZodType<T>;
  allowedSourceIds?: string[];
  /** Optional file part (scanned PDF transcription, §10.2). */
  file?: { name: string; mime: string; base64: string };
}

export interface LlmCallMeta {
  model: string;
  requestId?: string;
  inferenceRegion?: string;
  fallback?: boolean;
  fallbackReason?: string;
  usage?: Record<string, number>;
}

export interface LlmClient {
  generate<T>(req: LlmRequest<T>): Promise<T>;
  /** Metadata of the most recent call (never the prompt text), for the LlmCallLog. */
  lastCall?(): LlmCallMeta | undefined;
}

export interface JurisprudenceHit {
  id: string;
  kind: 'case' | 'legislation' | 'doctrine';
  title: string;
  neutralCitation?: string;
  court?: string;
  date?: string;
  url: string;
  passages: { text: string; paragraph?: string }[];
}

export interface JurisprudenceSearch {
  search(q: { text: string; lang: Lang; limit: number }): Promise<JurisprudenceHit[]>;
}

export interface StatuteArticle {
  instrument: string;
  article: string;
  text: string;
  url: string;
  /** Date from which this version is in force, if the source states it. */
  inForceFrom?: string;
  /** True when the source states the text was in force on the requested date. */
  inForceOnRequestedDate?: boolean;
}

export interface StatuteSource {
  getArticle(ref: { instrument: string; article: string; asOf: string }): Promise<StatuteArticle | null>;
}

export interface RenderedBlock {
  kind: 'heading' | 'paragraph' | 'table' | 'list' | 'banner';
  text?: string;
  rows?: string[][];
  items?: string[];
  level?: 1 | 2 | 3;
}

export interface RenderedSection {
  /** Stable key, also used in the named range (§12). */
  key: string;
  order: number;
  blocks: RenderedBlock[];
}

export interface DocumentWriter {
  upsertSection(s: RenderedSection): Promise<{ rangeName: string }>;
  removeRanges(rangeNames: string[]): Promise<void>;
  readSelection(): Promise<string>;
}

export interface CaseRepository {
  load(docId: string): Promise<CaseFile | null>;
  save(c: CaseFile): Promise<void>;
}

/** A document after text extraction in the sidebar (US-03). */
export interface ExtractedDocument {
  name: string;
  mime: string;
  segments: ExhibitSegment[];
  pages?: number;
  ocr?: boolean;
}

/** Extracted exhibit text lives outside the case JSON (§12). */
export interface ExhibitStore {
  put(caseId: string, exhibitId: string, segments: ExhibitSegment[]): Promise<string>;
  get(textRef: string): Promise<ExhibitSegment[] | null>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(prefix: string): string;
}
