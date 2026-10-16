import { useId } from 'react';
import type { Fact } from '../../core/model';
import { useT } from '../i18n';

const FAVORABILITY_ICON = { favorable: '▲', unfavorable: '▼', neutral: '•' } as const;

export interface FactChecklistProps {
  facts: Fact[];
  selected: string[];
  onToggle: (id: string) => void;
}

/** US-04 / US-05: timeline-sorted facts with G3 labels; labels are text, never color alone. */
export function FactChecklist({ facts, selected, onToggle }: FactChecklistProps) {
  const t = useT();
  const id = useId();
  return (
    <fieldset role="group" aria-labelledby={`${id}-legend`}>
      <legend id={`${id}-legend`}>{t('facts.legend')}</legend>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {facts.map((f) => (
          <li key={f.id} className="av-msg" data-favorability={f.favorability}>
            <input
              id={`${id}-${f.id}`}
              type="checkbox"
              value={f.id}
              checked={selected.includes(f.id)}
              onChange={() => onToggle(f.id)}
            />{' '}
            <label htmlFor={`${id}-${f.id}`}>
              <strong>{f.id}</strong> · {f.date ?? t('facts.undated')} — {f.text}
            </label>
            <div className="av-badges">
              <span className="av-badge">{t(`facts.status.${f.status}`)}</span>{' '}
              <span className="av-badge">{t(`facts.position.${f.position}`)}</span>{' '}
              <span className="av-badge">
                <span aria-hidden="true">{FAVORABILITY_ICON[f.favorability]} </span>
                {t(`facts.favorability.${f.favorability}`)}
              </span>
            </div>
            <small>
              {f.sourceRefs.length > 0
                ? f.sourceRefs.map((s) => `${s.exhibitId} ${s.locator}`).join(', ')
                : `⚠ ${t('facts.noSource')}`}
            </small>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
