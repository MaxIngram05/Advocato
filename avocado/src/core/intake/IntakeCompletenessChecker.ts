import { StanceSchema, type Party, type Stance } from '../model';

/** US-02 intake fields, in the order the bot asks for them. */
export const REQUIRED_INTAKE_FIELDS = [
  'court',
  'areaOfLaw',
  'stance',
  'objective',
  'dateOfFacts',
  'parties',
  'documents',
] as const;
export type IntakeField = (typeof REQUIRED_INTAKE_FIELDS)[number];

export const AREAS_OF_LAW = [
  'civil',
  'labour',
  'administrative',
  'penal',
  'human-rights',
  'consumer',
  'other',
] as const;

export interface IntakeDraft {
  court?: string;
  areaOfLaw?: string;
  stance?: Stance;
  objective?: string;
  dateOfFacts?: string;
  parties?: Pick<Party, 'name' | 'role'>[];
  documentCount?: number;
  procedureStage?: string;
  opposingArguments?: string[];
}

export interface IntakeCheck {
  complete: boolean;
  missing: IntakeField[];
}

const OBJECTIVES = {
  claimant: ['annulment', 'reduction', 'damages', 'other'],
  defendant: ['dismissal', 'limit-remedy', 'reduce-amount', 'other'],
  other: ['other'],
} as const;

/** Objectives are computed from the confirmed stance, never assumed (US-02, G10). */
export function objectiveOptions(stance: Stance | undefined): string[] {
  return stance ? [...OBJECTIVES[stance.role]] : [];
}

function isIsoDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const filled = (v: string | undefined) => (v ?? '').trim().length > 0;

/** `stage: 'intake'` leaves out documents, which are uploaded after intake (D7). */
export function checkIntake(draft: IntakeDraft, opts: { stage?: 'intake' | 'analysis' } = {}): IntakeCheck {
  const stanceOk = StanceSchema.safeParse(draft.stance).success;
  const ok: Record<IntakeField, boolean> = {
    court: filled(draft.court),
    areaOfLaw: (AREAS_OF_LAW as readonly string[]).includes(draft.areaOfLaw ?? ''),
    stance: stanceOk,
    objective:
      stanceOk && filled(draft.objective) && objectiveOptions(draft.stance).includes(draft.objective ?? ''),
    dateOfFacts: isIsoDate(draft.dateOfFacts),
    parties:
      (draft.parties?.length ?? 0) > 0 &&
      (draft.parties ?? []).every((p) => filled(p.name) && filled(p.role)),
    documents: (draft.documentCount ?? 0) >= 1,
  };
  if (opts.stage === 'intake') ok.documents = true;
  const missing = REQUIRED_INTAKE_FIELDS.filter((f) => !ok[f]);
  return { complete: missing.length === 0, missing };
}

/** One bot message asks at most 3 questions (US-02). Returns i18n keys. */
export function nextIntakeQuestions(missing: readonly IntakeField[]): string[] {
  return missing.slice(0, 3).map((f) => `intake.ask.${f}`);
}
