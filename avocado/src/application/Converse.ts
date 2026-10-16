import { z } from 'zod';
import { checkIntake, objectiveOptions } from '../core/intake/IntakeCompletenessChecker';
import type { Alert, CaseFile } from '../core/model';
import { sessionReducer } from '../core/session/sessionMachine';
import type { GroundedGenerator } from '../llm/GroundedGenerator';
import type { AllowedSource } from '../llm/PromptBuilder';
import type { IdGenerator } from '../ports';
import type { CaseUpdate } from './ExtractFacts';

const OBJECTIVES = ['annulment', 'reduction', 'damages', 'dismissal', 'limit-remedy', 'reduce-amount', 'other'] as const;
const AREAS = ['civil', 'labour', 'administrative', 'penal', 'human-rights', 'consumer', 'other'] as const;

export const ConverseOutputSchema = z.object({
  reply: z.string().min(1),
  extracted: z.object({
    court: z.string().nullable(),
    areaOfLaw: z.enum(AREAS).nullable(),
    dateOfFacts: z.string().nullable(),
    clientName: z.string().nullable(),
    clientRoleSuggestion: z.enum(['claimant', 'defendant', 'other']).nullable(),
    roleDescription: z.string().nullable(),
    opposingParties: z.array(z.string()),
    parties: z.array(z.object({ name: z.string(), role: z.string() })),
    objective: z.enum(OBJECTIVES).nullable(),
    opposingArguments: z.array(z.string()),
    legalIssue: z.string().nullable(),
    procedureStage: z.string().nullable(),
  }),
  citationIds: z.array(z.string()),
});
export type ConverseOutput = z.infer<typeof ConverseOutputSchema>;

/** A role the conversation points to. Shown for confirmation; never applied by itself (G10). */
export interface PendingStance {
  role: 'claimant' | 'defendant' | 'other';
  clientName: string;
  opposingParties: string[];
  roleDescription?: string;
}

const MISSING_LABEL: Record<string, string> = {
  court: 'the court or tribunal',
  areaOfLaw: 'the area of law',
  stance: 'which party the lawyer represents (name and side)',
  objective: 'the outcome the client is seeking',
  dateOfFacts: 'the date of the facts (month and year is enough)',
  parties: 'the parties and their roles',
};

/** Accepts YYYY-MM-DD or YYYY-MM (first day of the month). */
const toIso = (s: string): string | null => {
  const m = s.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  return m ? `${m[1]}-${m[2]}-${m[3] ?? '01'}` : null;
};
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

/** Applies what the model extracted. Never sets the stance (G10). */
export function applyExtraction(c: CaseFile, x: ConverseOutput['extracted']): CaseFile {
  const next: CaseFile = { ...c };
  if (x.court) next.court = x.court;
  if (x.areaOfLaw) next.areaOfLaw = x.areaOfLaw;
  const iso = x.dateOfFacts ? toIso(x.dateOfFacts) : null;
  if (iso && isIso(iso)) next.dateOfFacts = iso;
  if (x.parties.length > 0) next.parties = x.parties.filter((p) => p.name.trim() && p.role.trim());
  if (x.opposingArguments.length > 0) next.opposingArguments = [...new Set([...c.opposingArguments, ...x.opposingArguments])];
  if (x.legalIssue) next.legalIssue = x.legalIssue;
  if (x.procedureStage) next.procedureStage = x.procedureStage;
  if (x.objective) {
    if (c.stance && objectiveOptions(c.stance).includes(x.objective)) next.objective = x.objective;
    else next.intakeDraft = { ...(c.intakeDraft ?? {}), objective: x.objective };
  }
  if (!c.stance && (x.clientName || x.clientRoleSuggestion)) {
    const prev = (c.pendingStance as PendingStance | undefined) ?? undefined;
    const role = x.clientRoleSuggestion ?? prev?.role;
    const clientName = x.clientName ?? prev?.clientName;
    if (role && clientName) {
      next.pendingStance = {
        role,
        clientName,
        opposingParties: x.opposingParties.length ? x.opposingParties : (prev?.opposingParties ?? []),
        ...(x.roleDescription ? { roleDescription: x.roleDescription } : prev?.roleDescription ? { roleDescription: prev.roleDescription } : {}),
      } satisfies PendingStance;
    }
  }
  return next;
}

export function missingIntake(c: CaseFile): string[] {
  return checkIntake(
    {
      court: c.court,
      areaOfLaw: c.areaOfLaw,
      stance: c.stance,
      objective: c.objective,
      dateOfFacts: c.dateOfFacts,
      parties: c.parties,
    },
    { stage: 'intake' },
  ).missing;
}

/**
 * The chat turn: the model replies conversationally, extracts case information from the
 * lawyer's message and asks only for what is still missing. Intake closes automatically.
 */
export class Converse {
  constructor(
    private readonly llm: GroundedGenerator,
    private readonly ids: IdGenerator,
    private readonly now: () => Date,
  ) {}

  async execute(caseFile: CaseFile, message: string): Promise<CaseUpdate> {
    const analysis = caseFile.analysis as { causeOfAction?: string; remedy?: { principal?: { remedy?: string } } } | undefined;
    const sources: AllowedSource[] = caseFile.citations.map((c) => ({ id: c.id, title: c.title, pinpoints: [c.pinpoint], excerpt: '' }));
    const payload = {
      currentStep: caseFile.session.step,
      known: {
        court: caseFile.court || null,
        areaOfLaw: caseFile.areaOfLaw || null,
        dateOfFacts: caseFile.dateOfFacts || null,
        parties: caseFile.parties,
        objective: caseFile.objective ?? caseFile.intakeDraft?.objective ?? null,
        legalIssue: caseFile.legalIssue ?? null,
        roleConfirmedByLawyer: caseFile.stance ? `${caseFile.stance.clientName} (${caseFile.stance.role})` : null,
        roleAwaitingConfirmation: caseFile.pendingStance ?? null,
        opposingArguments: caseFile.opposingArguments,
      },
      missingInformation: caseFile.session.step === 'INTAKE' ? missingIntake(caseFile).map((k) => MISSING_LABEL[k] ?? k) : [],
      nextStep:
        caseFile.session.step === 'INTAKE' || caseFile.session.step === 'UPLOAD'
          ? 'the lawyer attaches the exhibits with the paperclip; their facts are then extracted automatically (do not mention any button)'
          : caseFile.session.step === 'FACT_REVIEW'
            ? 'the lawyer ticks the facts to use, then continues'
            : 'the lawyer reviews the draft and can ask questions about it',
      exhibits: caseFile.exhibits.map((e) => `${e.id} ${e.name}`),
      pendingDocuments: ((caseFile.pendingDocs as { name: string }[] | undefined) ?? []).map((d) => d.name),
      facts: caseFile.facts.slice(0, 60).map((f) => `${f.id} ${f.date ?? ''} ${f.text} [${f.status}, ${f.favorability}]`),
      draftSummary: analysis ? { causeOfAction: analysis.causeOfAction, remedy: analysis.remedy?.principal?.remedy } : null,
      conversation: caseFile.messages.slice(-12).map((m) => `${m.role === 'user' ? 'Lawyer' : 'Advocato'}: ${m.text}`),
      latestMessage: message,
    };
    const result = await this.llm.run({
      task: 'converse',
      caseFile,
      schema: ConverseOutputSchema,
      allowedSources: sources,
      facts: [],
      payload,
    });
    let next = applyExtraction(caseFile, result.value.extracted);
    const alerts: Alert[] = [...result.alerts];
    if (next.stance && next.session.step === 'INTAKE' && missingIntake(next).length === 0) {
      const session = sessionReducer(next.session, { type: 'INTAKE_COMPLETE' });
      if (!session.rejection) next = { ...next, session };
    }
    next = {
      ...next,
      messages: [...next.messages, { id: this.ids.next('M'), role: 'bot', text: result.value.reply, at: this.now().toISOString() }],
      alerts: [...next.alerts, ...alerts],
      llmCalls: [...next.llmCalls, ...result.calls],
    };
    return { caseFile: next, alerts };
  }
}
