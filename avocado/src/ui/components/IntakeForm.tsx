import { useId, useState, type FormEvent } from 'react';
import { AREAS_OF_LAW, objectiveOptions, type IntakeDraft } from '../../core/intake/IntakeCompletenessChecker';
import { StanceSchema, type Stance, type StanceSuggestion } from '../../core/model';
import { useT } from '../i18n';

export const COURTS = ['cq-civil', 'cq-small', 'cs', 'ca', 'tribunal', 'other'] as const;
type Role = Stance['role'];

export interface IntakeFormProps {
  confirmedStance: Stance | undefined;
  suggestion: StanceSuggestion | null;
  now: () => Date;
  onConfirmStance: (stance: Stance) => void;
  /** `court` is the official court name (resolved from the picklist, or free text). */
  onSubmit: (draft: Omit<IntakeDraft, 'stance' | 'documentCount'>) => void;
}

interface PartyRow {
  name: string;
  role: string;
}

/** US-02 intake. The stance has no default and is only set by an explicit click (G10). */
export function IntakeForm({ confirmedStance, suggestion, now, onConfirmStance, onSubmit }: IntakeFormProps) {
  const t = useT();
  const id = useId();
  const [court, setCourt] = useState('');
  const [courtOther, setCourtOther] = useState('');
  const [area, setArea] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [roleDescription, setRoleDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [opposing, setOpposing] = useState('');
  const [stanceError, setStanceError] = useState(false);
  const [suggestedFrom, setSuggestedFrom] = useState<StanceSuggestion['evidence'] | undefined>();
  const [objective, setObjective] = useState('');
  const [dateOfFacts, setDateOfFacts] = useState('');
  const [parties, setParties] = useState<PartyRow[]>([{ name: '', role: '' }]);
  const [procedureStage, setProcedureStage] = useState('');
  const [opposingArguments, setOpposingArguments] = useState('');

  const confirmStance = () => {
    const candidate = {
      role,
      ...(role === 'other' ? { roleDescription: roleDescription.trim() } : {}),
      clientName: clientName.trim(),
      opposingParties: opposing
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      confirmedByUser: true as const,
      confirmedAt: now().toISOString(),
      ...(suggestedFrom ? { suggestedFrom } : {}),
    };
    const parsed = StanceSchema.safeParse(candidate);
    setStanceError(!parsed.success);
    if (parsed.success) onConfirmStance(parsed.data);
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setRole(suggestion.role);
    setClientName(suggestion.clientName);
    setSuggestedFrom(suggestion.evidence);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const courtName = court === 'other' ? courtOther.trim() : court ? t(`court.${court}`) : '';
    onSubmit({
      court: courtName,
      areaOfLaw: area,
      objective,
      dateOfFacts,
      parties: parties.filter((p) => p.name.trim() || p.role.trim()).map((p) => ({ name: p.name.trim(), role: p.role.trim() })),
      ...(procedureStage.trim() ? { procedureStage: procedureStage.trim() } : {}),
      opposingArguments: opposingArguments
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  const objectives = objectiveOptions(confirmedStance);
  const f = (name: string) => `${id}-${name}`;

  return (
    <form className="av-panel" onSubmit={submit} aria-labelledby={f('title')}>
      <h2 id={f('title')}>{t('intake.title')}</h2>

      {suggestion && (
        <section className="av-msg" role="region" aria-label={t('stance.suggestionTitle')}>
          <p style={{ margin: 0 }}>
            {t('stance.suggestion', { name: suggestion.clientName, role: t(`stance.${suggestion.role}`) })}
          </p>
          <ul>
            {suggestion.evidence.map((ev) => (
              <li key={`${ev.exhibitId}-${ev.locator}`}>
                {ev.exhibitId} {ev.locator} — « {ev.excerpt} »
              </li>
            ))}
          </ul>
          <button type="button" onClick={useSuggestion}>
            {t('stance.useSuggestion')}
          </button>
        </section>
      )}

      <fieldset>
        <legend>{t('stance.legend')}</legend>
        {(['claimant', 'defendant', 'other'] as const).map((r) => (
          <label key={r} style={{ display: 'block' }}>
            <input type="radio" name={f('role')} value={r} checked={role === r} onChange={() => setRole(r)} />{' '}
            {t(`stance.${r}`)}
          </label>
        ))}
        {role === 'other' && (
          <div className="av-field">
            <label htmlFor={f('roleDescription')}>{t('stance.roleDescription')}</label>
            <input id={f('roleDescription')} value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
          </div>
        )}
        <div className="av-field">
          <label htmlFor={f('clientName')}>{t('stance.clientName')}</label>
          <input id={f('clientName')} value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="av-field">
          <label htmlFor={f('opposing')}>{t('stance.opposingParties')}</label>
          <input id={f('opposing')} value={opposing} onChange={(e) => setOpposing(e.target.value)} />
        </div>
        <button type="button" onClick={confirmStance} disabled={role === ''}>
          {t('stance.confirm')}
        </button>
        {stanceError && (
          <p role="alert" className="av-alert" data-severity="warning">
            ⚠ {t('stance.invalid')}
          </p>
        )}
        {confirmedStance && (
          <p>
            ✓{' '}
            {t('stance.confirmed', {
              role: confirmedStance.roleDescription ?? t(`stance.${confirmedStance.role}`),
              name: confirmedStance.clientName,
            })}
          </p>
        )}
      </fieldset>

      <div className="av-field">
        <label htmlFor={f('objective')}>{t('intake.objective')}</label>
        <select
          id={f('objective')}
          value={objective}
          disabled={!confirmedStance}
          aria-describedby={confirmedStance ? undefined : f('objectiveLocked')}
          onChange={(e) => setObjective(e.target.value)}
        >
          <option value="">—</option>
          {objectives.map((o) => (
            <option key={o} value={o}>
              {t(`objective.${o}`)}
            </option>
          ))}
        </select>
        {!confirmedStance && <small id={f('objectiveLocked')}>{t('intake.objectiveLocked')}</small>}
      </div>

      <div className="av-field">
        <label htmlFor={f('court')}>{t('intake.court')}</label>
        <select id={f('court')} value={court} onChange={(e) => setCourt(e.target.value)}>
          <option value="">—</option>
          {COURTS.map((c) => (
            <option key={c} value={c}>
              {t(`court.${c}`)}
            </option>
          ))}
        </select>
      </div>
      {court === 'other' && (
        <div className="av-field">
          <label htmlFor={f('courtOther')}>{t('intake.courtOther')}</label>
          <input id={f('courtOther')} value={courtOther} onChange={(e) => setCourtOther(e.target.value)} />
        </div>
      )}

      <div className="av-field">
        <label htmlFor={f('area')}>{t('intake.areaOfLaw')}</label>
        <select id={f('area')} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">—</option>
          {AREAS_OF_LAW.map((a) => (
            <option key={a} value={a}>
              {t(`area.${a}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="av-field">
        <label htmlFor={f('date')}>{t('intake.dateOfFacts')}</label>
        <input id={f('date')} type="date" value={dateOfFacts} onChange={(e) => setDateOfFacts(e.target.value)} />
      </div>

      <fieldset role="group" aria-labelledby={f('partiesLegend')}>
        <legend id={f('partiesLegend')}>{t('intake.parties')}</legend>
        {parties.map((p, i) => (
          <div key={i} className="av-field">
            <label htmlFor={f(`pn${i}`)}>{t('intake.partyName')}</label>
            <input
              id={f(`pn${i}`)}
              value={p.name}
              onChange={(e) => setParties(parties.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
            />
            <label htmlFor={f(`pr${i}`)}>{t('intake.partyRole')}</label>
            <input
              id={f(`pr${i}`)}
              value={p.role}
              onChange={(e) => setParties(parties.map((q, j) => (j === i ? { ...q, role: e.target.value } : q)))}
            />
          </div>
        ))}
        <button type="button" onClick={() => setParties([...parties, { name: '', role: '' }])}>
          {t('intake.addParty')}
        </button>
      </fieldset>

      <div className="av-field">
        <label htmlFor={f('stage')}>{t('intake.procedureStage')}</label>
        <input id={f('stage')} value={procedureStage} onChange={(e) => setProcedureStage(e.target.value)} />
      </div>
      <div className="av-field">
        <label htmlFor={f('opposingArgs')}>{t('intake.opposingArguments')}</label>
        <textarea id={f('opposingArgs')} value={opposingArguments} onChange={(e) => setOpposingArguments(e.target.value)} />
      </div>

      <button type="submit">{t('intake.continue')}</button>
    </form>
  );
}
