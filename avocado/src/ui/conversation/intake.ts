import { objectiveOptions } from '../../core/intake/IntakeCompletenessChecker';
import { AREAS_OF_LAW } from '../../core/intake/IntakeCompletenessChecker';
import type { CaseFile, Lang } from '../../core/model';

/** Conversational intake (US-02): one question per bot message, answers stored on the case. */
export type IntakeKey =
  | 'role'
  | 'roleDescription'
  | 'clientName'
  | 'opposing'
  | 'confirm'
  | 'objective'
  | 'court'
  | 'courtOther'
  | 'area'
  | 'date'
  | 'transactionRole'
  | 'opposingArgs';

export interface Chip {
  value: string;
  label: string;
}

export interface Question {
  key: IntakeKey;
  text: string;
  chips: Chip[];
  /** Free text is accepted for this question. */
  freeText: boolean;
  placeholder?: string;
}

export const COURTS = ['cq-civil', 'cq-small', 'cs', 'ca', 'tribunal', 'other'] as const;

const TXT = {
  fr: {
    role: 'Pour commencer : quel est le rôle de votre client dans ce dossier?',
    roleDescription: 'Précisez le rôle de votre client.',
    clientName: 'Quel est le nom de votre client?',
    opposing: 'Qui est la partie adverse? (plusieurs noms : séparez-les par des virgules)',
    confirm: 'Je résume : vous représentez {name}, {role}, contre {opposing}. Est-ce exact?',
    objective: 'Quel résultat votre client recherche-t-il?',
    court: 'Devant quel tribunal?',
    courtOther: 'Quel tribunal, exactement?',
    area: 'Quel est le domaine de droit?',
    date: 'Quelle est la date des faits? (p. ex. 2025-10-09 ou 9 octobre 2025)',
    transactionRole: 'Dans l’opération en cause, {name} est…',
    opposingArgs: 'La partie adverse a-t-elle déjà soulevé des arguments? Écrivez-les, ou passez.',
    confirmYes: 'Oui, c’est exact',
    confirmNo: 'Non, recommencer',
    skip: 'Aucun / passer',
    buyer: 'l’acheteur',
    seller: 'le vendeur',
    other: 'Autre',
    claimant: 'demandeur',
    defendant: 'défendeur',
    badDate: 'Je n’ai pas compris la date. Essayez le format AAAA-MM-JJ.',
    pickChip: 'Choisissez une des options ci-dessous.',
  },
  en: {
    role: 'To start: what is your client’s role in this case?',
    roleDescription: 'Describe your client’s role.',
    clientName: 'What is your client’s name?',
    opposing: 'Who is the opposing party? (several names: separate them with commas)',
    confirm: 'To sum up: you act for {name}, {role}, against {opposing}. Is that right?',
    objective: 'What outcome is your client seeking?',
    court: 'Which court?',
    courtOther: 'Which court, exactly?',
    area: 'What is the area of law?',
    date: 'What is the date of the facts? (e.g. 2025-10-09)',
    transactionRole: 'In the transaction at issue, {name} is…',
    opposingArgs: 'Has the other side already raised arguments? Type them, or skip.',
    confirmYes: 'Yes, that’s right',
    confirmNo: 'No, start over',
    skip: 'None / skip',
    buyer: 'the buyer',
    seller: 'the seller',
    other: 'Other',
    claimant: 'claimant',
    defendant: 'defendant',
    badDate: 'I could not read that date. Try YYYY-MM-DD.',
    pickChip: 'Pick one of the options below.',
  },
} as const;

export const intakeText = (lang: Lang, key: keyof (typeof TXT)['fr']) => TXT[lang][key];

type Labels = (key: string) => string;

const draftOf = (c: CaseFile): Record<string, string> => c.intakeDraft ?? {};

/** The next intake question, or null when intake is complete. */
export function nextQuestion(c: CaseFile, t: Labels): Question | null {
  const lang = c.lang;
  const T = TXT[lang];
  const d = draftOf(c);
  const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
  const q = (key: IntakeKey, text: string, chips: Chip[] = [], freeText = chips.length === 0): Question => ({ key, text, chips, freeText });

  if (!c.stance) {
    if (!d.role) {
      return q('role', T.role, [
        { value: 'claimant', label: t('stance.claimant') },
        { value: 'defendant', label: t('stance.defendant') },
        { value: 'other', label: t('stance.other') },
      ]);
    }
    if (d.role === 'other' && !d.roleDescription) return q('roleDescription', T.roleDescription);
    if (!d.clientName) return q('clientName', T.clientName);
    if (d.opposing === undefined) return q('opposing', T.opposing);
    const role = d.role === 'other' ? d.roleDescription ?? '' : T[d.role as 'claimant' | 'defendant'];
    return q('confirm', fill(T.confirm, { name: d.clientName, role, opposing: d.opposing || '—' }), [
      { value: 'yes', label: T.confirmYes },
      { value: 'no', label: T.confirmNo },
    ]);
  }
  if (!c.objective) {
    return q('objective', T.objective, objectiveOptions(c.stance).map((o) => ({ value: o, label: t(`objective.${o}`) })));
  }
  if (!c.court) {
    if (d.court === 'other') return q('courtOther', T.courtOther);
    return q('court', T.court, COURTS.map((v) => ({ value: v, label: t(`court.${v}`) })));
  }
  if (!c.areaOfLaw) return q('area', T.area, AREAS_OF_LAW.map((v) => ({ value: v, label: t(`area.${v}`) })));
  if (!c.dateOfFacts) return q('date', T.date);
  if (c.parties.length === 0) {
    return q(
      'transactionRole',
      fill(T.transactionRole, { name: c.stance.clientName }),
      [
        { value: 'buyer', label: T.buyer },
        { value: 'seller', label: T.seller },
      ],
      true,
    );
  }
  if (d.opposingArgsDone !== 'yes') return q('opposingArgs', T.opposingArgs, [{ value: '', label: T.skip }], true);
  return null;
}

const MONTHS: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12', january: '01', february: '02', march: '03',
  april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

/** Accepts 2025-10-09, 09/10/2025 or "9 octobre 2025". */
export function parseDate(input: string): string | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let iso: string | null = null;
  if (m) iso = `${m[1]}-${m[2]?.padStart(2, '0')}-${m[3]?.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!iso && m) iso = `${m[3]}-${m[2]?.padStart(2, '0')}-${m[1]?.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})$/);
  if (!iso && m && m[2] && MONTHS[m[2]]) iso = `${m[3]}-${MONTHS[m[2]]}-${m[1]?.padStart(2, '0')}`;
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || !d.toISOString().startsWith(iso) ? null : iso;
}

export interface Answer {
  /** What to show as the user's bubble. */
  echo: string;
  /** Updated case (draft fields and/or case fields), or an error message to say instead. */
  caseFile?: CaseFile;
  error?: string;
  /** The stance was just confirmed by an explicit click (G10). */
  confirmStance?: boolean;
  /** Intake is now complete. */
  complete?: boolean;
}

/** Applies an answer (chip value or free text) to the current question. */
export function applyAnswer(c: CaseFile, question: Question, raw: string, chipLabel?: string): Answer {
  const T = TXT[c.lang];
  const value = raw.trim();
  const echo = chipLabel ?? value;
  const d = { ...draftOf(c) };
  const withDraft = (patch: Record<string, string>): CaseFile => ({ ...c, intakeDraft: { ...d, ...patch } });
  const chip = question.chips.find((x) => x.value === value || x.label.toLowerCase() === value.toLowerCase());

  switch (question.key) {
    case 'role':
      if (!chip) return { echo, error: T.pickChip };
      return { echo, caseFile: withDraft({ role: chip.value }) };
    case 'roleDescription':
      return value ? { echo, caseFile: withDraft({ roleDescription: value }) } : { echo, error: T.roleDescription };
    case 'clientName':
      return value ? { echo, caseFile: withDraft({ clientName: value }) } : { echo, error: T.clientName };
    case 'opposing':
      return { echo, caseFile: withDraft({ opposing: value }) };
    case 'confirm':
      if (!chip) return { echo, error: T.pickChip };
      if (chip.value === 'no') return { echo, caseFile: { ...c, intakeDraft: {} } };
      return { echo, caseFile: c, confirmStance: true };
    case 'objective':
      return chip ? { echo, caseFile: { ...c, objective: chip.value } } : { echo, error: T.pickChip };
    case 'court':
      if (!chip) return { echo, error: T.pickChip };
      if (chip.value === 'other') return { echo, caseFile: withDraft({ court: 'other' }) };
      return { echo, caseFile: { ...c, court: chip.label } };
    case 'courtOther':
      return value ? { echo, caseFile: { ...c, court: value } } : { echo, error: T.courtOther };
    case 'area':
      return chip ? { echo, caseFile: { ...c, areaOfLaw: chip.value } } : { echo, error: T.pickChip };
    case 'date': {
      const iso = parseDate(value);
      return iso ? { echo, caseFile: { ...c, dateOfFacts: iso } } : { echo, error: T.badDate };
    }
    case 'transactionRole': {
      if (!c.stance || !value) return { echo, error: T.pickChip };
      const fr = c.lang === 'fr';
      const own = chip ? (chip.value === 'buyer' ? (fr ? 'acheteur' : 'buyer') : fr ? 'vendeur' : 'seller') : value;
      const other = chip ? (chip.value === 'buyer' ? (fr ? 'vendeur' : 'seller') : fr ? 'acheteur' : 'buyer') : fr ? 'partie adverse' : 'opposing party';
      return {
        echo,
        caseFile: {
          ...c,
          parties: [
            { name: c.stance.clientName, role: own },
            ...c.stance.opposingParties.map((name) => ({ name, role: other })),
          ],
        },
      };
    }
    case 'opposingArgs':
      return {
        echo: echo || T.skip,
        caseFile: {
          ...withDraft({ opposingArgsDone: 'yes' }),
          opposingArguments: value ? value.split(/\n|;/).map((s) => s.trim()).filter(Boolean) : [],
        },
        complete: true,
      };
  }
}
