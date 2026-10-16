import { z } from 'zod';
import {
  AlertSchema,
  ArgumentOptionSchema,
  CauseOfActionIdSchema,
  ChatMessageSchema,
  CitationSchema,
  CounterArgumentSchema,
  ExhibitSchema,
  ExhibitSegmentSchema,
  FactPositionSchema,
  FactSchema,
  FactStatusSchema,
  FavorabilitySchema,
  LangSchema,
  LlmCallLogSchema,
  MatrixRowSchema,
  PartySchema,
  RebuttalSchema,
  RemedyChoiceSchema,
  RemedyDecisionSchema,
  SeveritySchema,
  SourceRefSchema,
  StanceSchema,
  StanceSuggestionSchema,
  VerificationSchema,
  WrittenArgumentSchema,
} from './schemas';
import {
  DiscardedAnalysisSchema,
  SessionSnapshotSchema,
  SessionStateSchema,
  StepSchema,
  WrittenRoundSchema,
} from './session';

export * from './schemas';
export * from './session';

export const CURRENT_SCHEMA_VERSION = 1;

/** Rich data captured on ARGUMENT_PICK entry so rollback can restore options and matrix (§12). */
export const CaseSnapshotSchema = z.object({
  round: z.number().int().positive(),
  options: z.array(ArgumentOptionSchema),
  rows: z.array(MatrixRowSchema),
  facts: z.array(FactSchema),
});

export const CaseFileSchema = z.object({
  id: z.string(),
  docId: z.string(),
  lang: LangSchema,
  court: z.string(),
  areaOfLaw: z.string(),
  stance: StanceSchema.optional(),
  objective: z.string().optional(),
  dateOfFacts: z.string(),
  procedureStage: z.string().optional(),
  opposingArguments: z.array(z.string()),
  parties: z.array(PartySchema),
  causesOfAction: z.array(CauseOfActionIdSchema),
  exhibits: z.array(ExhibitSchema),
  facts: z.array(FactSchema),
  citations: z.array(CitationSchema),
  arguments: z.array(WrittenArgumentSchema),
  damages: z.array(MatrixRowSchema),
  remedy: RemedyDecisionSchema.optional(),
  alerts: z.array(AlertSchema),
  messages: z.array(ChatMessageSchema),
  snapshots: z.array(CaseSnapshotSchema),
  llmCalls: z.array(LlmCallLogSchema),
  session: SessionStateSchema,
  schemaVersion: z.number().int().positive(),
});

export type Lang = z.infer<typeof LangSchema>;
export type FactStatus = z.infer<typeof FactStatusSchema>;
export type FactPosition = z.infer<typeof FactPositionSchema>;
export type Favorability = z.infer<typeof FavorabilitySchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Exhibit = z.infer<typeof ExhibitSchema>;
export type ExhibitSegment = z.infer<typeof ExhibitSegmentSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type MatrixRow = z.infer<typeof MatrixRowSchema>;
export type Rebuttal = z.infer<typeof RebuttalSchema>;
export type CounterArgument = z.infer<typeof CounterArgumentSchema>;
export type ArgumentOption = z.infer<typeof ArgumentOptionSchema>;
export type WrittenArgument = z.infer<typeof WrittenArgumentSchema>;
export type RemedyChoice = z.infer<typeof RemedyChoiceSchema>;
export type RemedyDecision = z.infer<typeof RemedyDecisionSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Stance = z.infer<typeof StanceSchema>;
export type StanceSuggestion = z.infer<typeof StanceSuggestionSchema>;
export type CauseOfActionId = z.infer<typeof CauseOfActionIdSchema>;
export type Party = z.infer<typeof PartySchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type LlmCallLog = z.infer<typeof LlmCallLogSchema>;
export type Step = z.infer<typeof StepSchema>;
export type WrittenRound = z.infer<typeof WrittenRoundSchema>;
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;
export type DiscardedAnalysis = z.infer<typeof DiscardedAnalysisSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type CaseSnapshot = z.infer<typeof CaseSnapshotSchema>;
export type CaseFile = z.infer<typeof CaseFileSchema>;

export function initialSession(): SessionState {
  return {
    step: 'GREETING',
    round: 1,
    missingFields: [],
    allFactIds: [],
    factPool: [],
    selectedFactIds: [],
    optionIds: [],
    written: [],
    snapshots: [],
    discarded: [],
    errors: [],
  };
}

/** A fresh case: no stance, no objective, nothing assumed (G10). */
export function newCaseFile(init: { id: string; docId: string; lang: Lang }): CaseFile {
  return {
    ...init,
    court: '',
    areaOfLaw: '',
    dateOfFacts: '',
    opposingArguments: [],
    parties: [],
    causesOfAction: [],
    exhibits: [],
    facts: [],
    citations: [],
    arguments: [],
    damages: [],
    alerts: [],
    messages: [],
    snapshots: [],
    llmCalls: [],
    session: initialSession(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
