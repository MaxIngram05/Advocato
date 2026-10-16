import type { Lang } from '../../core/model';
import { useT } from '../i18n';

export function LanguageToggle({ lang, onChange }: { lang: Lang | undefined; onChange: (l: Lang) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t('language.label')}>
      {(['fr', 'en'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => onChange(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
