import { StanceNotConfirmedError } from '../core/errors';
import type { CaseFile, Fact, Lang, Stance } from '../core/model';
import type { LlmTask } from '../ports';
import { CHARTER, LANG_NAME, RETRY_NOTICE, ROLE_NAME } from './prompts/charter';
import { PROMPT_TEMPLATES } from './prompts';

/** One entry of ALLOWED_SOURCES (§14.2). */
export interface AllowedSource {
  id: string;
  title: string;
  pinpoints: string[];
  excerpt: string;
}

export interface PromptRequest {
  task: LlmTask;
  caseFile: CaseFile;
  allowedSources: AllowedSource[];
  facts: Fact[];
  payload: unknown;
  validationErrors?: string[];
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

/** Role variables resolved from the confirmed stance (G10). */
export function roleVariables(stance: Stance, lang: Lang) {
  return {
    clientName: stance.clientName,
    clientRole: stance.role === 'other' ? (stance.roleDescription ?? '') : ROLE_NAME[lang][stance.role],
    opposingParties: stance.opposingParties.join(', ') || '—',
  };
}

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);

const factForPrompt = (f: Fact) => ({
  id: f.id,
  text: f.text,
  date: f.date,
  status: f.status,
  position: f.position,
  favorability: f.favorability,
  sources: f.sourceRefs.map((s) => `${s.exhibitId} ${s.locator}`),
});

/** §14.2: charter + task instructions; refuses to build without a confirmed stance. */
export class PromptBuilder {
  build(req: PromptRequest): BuiltPrompt {
    const { caseFile } = req;
    const stance = caseFile.stance;
    if (stance?.confirmedByUser !== true) throw new StanceNotConfirmedError();
    const lang = caseFile.lang;
    const roles = roleVariables(stance, lang);
    const vars: Record<string, string> = {
      ...roles,
      court: caseFile.court,
      areaOfLaw: caseFile.areaOfLaw,
      causesOfAction: caseFile.causesOfAction.join(', ') || '—',
      dateOfFacts: caseFile.dateOfFacts,
      objective: caseFile.objective ?? '—',
      langName: LANG_NAME[lang],
      allowedSources: JSON.stringify(req.allowedSources),
      caseFacts: JSON.stringify(req.facts.map(factForPrompt)),
    };
    const system = `${fill(CHARTER[lang], vars)}\n\n${fill(PROMPT_TEMPLATES[req.task].instructions[lang], roles)}`;
    const retry = req.validationErrors?.length
      ? `\n\n${RETRY_NOTICE[lang]}\n${req.validationErrors.map((e) => `- ${e}`).join('\n')}`
      : '';
    return { system, user: `${JSON.stringify(req.payload)}${retry}` };
  }
}
