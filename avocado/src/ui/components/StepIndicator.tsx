import type { Step } from '../../core/model';
import { useT } from '../i18n';

const VISIBLE: Step[] = ['INTAKE', 'UPLOAD', 'FACT_REVIEW', 'ARGUMENT_PICK', 'COUNTER_REVIEW', 'STASIS'];

export function StepIndicator({ step, round }: { step: Step; round: number }) {
  const t = useT();
  return (
    <nav className="av-steps" aria-label={t('step.label')}>
      <ol>
        {VISIBLE.map((s) => (
          <li key={s} aria-current={s === step ? 'step' : undefined}>
            {t(`step.${s}`)}
            {s === 'FACT_REVIEW' && round > 1 ? ` (${round})` : ''}
          </li>
        ))}
      </ol>
    </nav>
  );
}
