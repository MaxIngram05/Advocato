import { useState } from 'react';
import { FactPool } from '../../core/facts/FactPool';
import type { CaseFile } from '../../core/model';
import { FactChecklist } from '../components/FactChecklist';
import { useT } from '../i18n';

export interface FactReviewStepProps {
  caseFile: CaseFile;
  onSelect: (factIds: string[]) => void;
}

/** US-05: tick facts from the current pool; at least one is required to continue. */
export function FactReviewStep({ caseFile, onSelect }: FactReviewStepProps) {
  const t = useT();
  const facts = new FactPool(caseFile.facts, caseFile.session).selectable();
  const [selected, setSelected] = useState<string[]>(caseFile.session.selectedFactIds);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const ordered = facts.map((f) => f.id).filter((id) => selected.includes(id));
  return (
    <section className="av-panel" aria-label={t('facts.title')}>
      <FactChecklist facts={facts} selected={selected} onToggle={toggle} />
      {ordered.length === 0 && <p id="av-facts-need">{t('facts.needOne')}</p>}
      <button
        type="button"
        className="av-primary"
        disabled={ordered.length === 0}
        aria-describedby={ordered.length === 0 ? 'av-facts-need' : undefined}
        onClick={() => onSelect(ordered)}
      >
        {t('facts.continue', { count: ordered.length })}
      </button>
    </section>
  );
}
