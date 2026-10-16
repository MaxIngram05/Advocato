import { z } from 'zod';
import {
  FactPositionSchema,
  FactStatusSchema,
  FavorabilitySchema,
  SourceRefSchema,
  StanceRoleSchema,
} from '../../core/model';

/** §14.1 output schemas. Ids for new objects are assigned by the app, never by the model. */

export const ExtractedFactSchema = z.object({
  text: z.string().min(1),
  date: z.string().nullable().optional(),
  parties: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  status: FactStatusSchema,
  position: FactPositionSchema,
  favorability: FavorabilitySchema,
});

export const ExtractFactsOutputSchema = z.object({
  facts: z.array(ExtractedFactSchema),
  uncertainties: z.array(z.string()),
});
export type ExtractFactsOutput = z.infer<typeof ExtractFactsOutputSchema>;

export const SuggestStanceOutputSchema = z.object({
  suggestion: z
    .object({
      role: StanceRoleSchema,
      clientName: z.string().min(1),
      evidence: z.array(SourceRefSchema),
      confidence: z.number().min(0).max(1),
    })
    .nullable(),
});
export type SuggestStanceOutput = z.infer<typeof SuggestStanceOutputSchema>;

export const TranscribePdfOutputSchema = z.object({
  pages: z.array(z.object({ page: z.number().int().positive(), text: z.string() })),
});
export type TranscribePdfOutput = z.infer<typeof TranscribePdfOutputSchema>;
