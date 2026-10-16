import { z } from 'zod';
import { LangSchema, SeveritySchema, StanceSchema } from './schemas';

/** Serializable state of the §7 workflow machine (ids only; rich data lives in the CaseFile). */

export const StepSchema = z.enum([
  'GREETING',
  'INTAKE',
  'UPLOAD',
  'FACT_REVIEW',
  'ANALYSING',
  'ARGUMENT_PICK',
  'COUNTER_REVIEW',
  'WRITING',
  'ROUND_END',
  'STASIS',
]);

export const WrittenRoundSchema = z.object({
  round: z.number().int().positive(),
  optionIds: z.array(z.string()),
  usedFactIds: z.array(z.string()),
  rangeNames: z.array(z.string()),
});

export const SessionSnapshotSchema = z.object({
  round: z.number().int().positive(),
  factPool: z.array(z.string()),
  selectedFactIds: z.array(z.string()),
  optionIds: z.array(z.string()),
  written: z.array(WrittenRoundSchema),
});

export const DiscardedAnalysisSchema = SessionSnapshotSchema.extend({
  stance: StanceSchema,
});

export const SessionStateSchema = z.object({
  step: StepSchema,
  lang: LangSchema.optional(),
  round: z.number().int().positive(),
  stance: StanceSchema.optional(),
  missingFields: z.array(z.string()),
  allFactIds: z.array(z.string()),
  factPool: z.array(z.string()),
  selectedFactIds: z.array(z.string()),
  optionIds: z.array(z.string()),
  pendingSelection: z.object({ optionIds: z.array(z.string()), usedFactIds: z.array(z.string()) }).optional(),
  written: z.array(WrittenRoundSchema),
  snapshots: z.array(SessionSnapshotSchema),
  discarded: z.array(DiscardedAnalysisSchema),
  errors: z.array(z.object({ message: z.string(), severity: SeveritySchema })),
  rejection: z.object({ type: z.string(), reason: z.string() }).optional(),
});
