import { z } from 'zod';

/** §9.4 key types, as zod schemas. Types are inferred so runtime and compile time agree. */

export const LangSchema = z.enum(['fr', 'en']);
export const FactStatusSchema = z.enum(['provided', 'proven', 'hypothesis', 'missing']);
export const FactPositionSchema = z.enum(['admitted', 'contested', 'unknown']);
export const FavorabilitySchema = z.enum(['favorable', 'unfavorable', 'neutral']);
export const SeveritySchema = z.enum(['info', 'warning', 'critical']);

export const SourceRefSchema = z.object({
  exhibitId: z.string(),
  locator: z.string(),
  excerpt: z.string(),
});

export const ExhibitSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  textRef: z.string(),
  pages: z.number().int().positive().optional(),
  ocr: z.boolean().optional(),
});

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  date: z.string().optional(),
  parties: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  status: FactStatusSchema,
  position: FactPositionSchema,
  favorability: FavorabilitySchema,
  usedInArgumentId: z.string().optional(),
});

export const VerificationSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('verified'),
    method: z.enum(['caij', 'statute-fetch']),
    checkedAt: z.string(),
  }),
  z.object({ state: z.literal('unverified'), reason: z.string() }),
]);

export const CitationSchema = z.object({
  id: z.string(),
  kind: z.enum(['statute', 'regulation', 'case', 'doctrine']),
  title: z.string(),
  neutralCitation: z.string().optional(),
  instrument: z.string().optional(),
  article: z.string().optional(),
  court: z.string().optional(),
  date: z.string().optional(),
  pinpoint: z.string(),
  url: z.string(),
  versionAsOf: z.string().optional(),
  quote: z.string().optional(),
  verification: VerificationSchema,
});

export const MatrixRowSchema = z.object({
  id: z.string(),
  elementId: z.string(),
  factIds: z.array(z.string()),
  evidence: z.array(SourceRefSchema),
  analysis: z.string(),
  gap: z.string().optional(),
  argument: z.string(),
  conclusionSought: z.string(),
  citationIds: z.array(z.string()),
  confidence: z.enum(['established', 'arguable', 'weak', 'missing']),
});

export const RebuttalSchema = z.object({
  id: z.string(),
  text: z.string(),
  citationIds: z.array(z.string()),
  factIds: z.array(z.string()),
  accepted: z.boolean(),
});

export const CounterArgumentSchema = z.object({
  id: z.string(),
  text: z.string(),
  origin: z.enum(['stated', 'anticipated']),
  citationIds: z.array(z.string()),
  rebuttals: z.array(RebuttalSchema),
});

export const StrengthSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const ArgumentOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  strength: StrengthSchema,
  elementIds: z.array(z.string()),
  factIds: z.array(z.string()),
  citationIds: z.array(z.string()),
  risks: z.array(z.string()),
});

export const WrittenArgumentSchema = z.object({
  round: z.number().int().positive(),
  option: ArgumentOptionSchema,
  rows: z.array(MatrixRowSchema),
  counters: z.array(CounterArgumentSchema),
  rangeNames: z.array(z.string()),
});

export const RemedyChoiceSchema = z.object({
  remedyId: z.string(),
  justification: z.string(),
  satisfiedConditions: z.array(z.string()),
  citationIds: z.array(z.string()),
});

export const RemedyDecisionSchema = z.object({
  principal: RemedyChoiceSchema,
  alternatives: z.array(RemedyChoiceSchema),
  rejected: z.array(z.object({ remedyId: z.string(), reason: z.string() })),
});

export const AlertSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  target: z
    .object({ kind: z.enum(['fact', 'row', 'citation', 'element']), id: z.string() })
    .optional(),
});

export const StanceRoleSchema = z.enum(['claimant', 'defendant', 'other']);

/** G10: the type forbids an unconfirmed stance. */
export const StanceSchema = z
  .object({
    role: StanceRoleSchema,
    roleDescription: z.string().optional(),
    clientName: z.string().min(1),
    opposingParties: z.array(z.string()),
    confirmedByUser: z.literal(true),
    confirmedAt: z.string(),
    suggestedFrom: z.array(SourceRefSchema).optional(),
  })
  .refine((s) => s.role !== 'other' || (s.roleDescription ?? '').trim().length > 0, {
    message: 'roleDescription is required when role is "other"',
    path: ['roleDescription'],
  });

export const StanceSuggestionSchema = z.object({
  role: StanceRoleSchema,
  clientName: z.string(),
  evidence: z.array(SourceRefSchema),
  confidence: z.number().min(0).max(1),
});

export const CauseOfActionIdSchema = z.enum([
  'COA_LATENT_DEFECT',
  'COA_DELIVERY',
  'COA_OWNERSHIP',
  'COA_FRAUD',
  'COA_CONSUMER',
]);

export const PartySchema = z.object({
  name: z.string(),
  role: z.string(),
  isProfessional: z.boolean().optional(),
  isMerchant: z.boolean().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['bot', 'user']),
  text: z.string(),
  at: z.string(),
});

export const LlmCallLogSchema = z.object({
  task: z.string(),
  at: z.string(),
  model: z.string(),
  requestId: z.string().optional(),
  inferenceRegion: z.string().optional(),
  fallback: z.boolean().optional(),
  fallbackReason: z.string().optional(),
  usage: z.record(z.string(), z.number()).optional(),
});
