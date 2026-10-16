import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../../core/model';
import { useT } from '../i18n';

/** Gear menu: language, document selection, new case. */
export function SettingsMenu({
  lang,
  onLanguage,
  onUseSelection,
  onNewCase,
  onTranslate,
}: {
  lang: Lang;
  onLanguage: (l: Lang) => void;
  onUseSelection: () => void;
  onNewCase: () => void;
  onTranslate: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="av-settings" ref={ref}>
      <button type="button" className="av-icon-btn" aria-label={t('settings.title')} aria-expanded={open} onClick={() => setOpen(!open)}>
        ⚙
      </button>
      {open && (
        <div className="av-menu" role="menu">
          <div className="av-menu-label">{t('language.label')}</div>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={lang === l}
              onClick={() => {
                onLanguage(l);
                setOpen(false);
              }}
            >
              {lang === l ? '✓ ' : ''}
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onUseSelection();
              setOpen(false);
            }}
          >
            {t('upload.useSelection')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTranslate();
              setOpen(false);
            }}
          >
            {t('settings.translate')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNewCase();
              setOpen(false);
            }}
          >
            {t('settings.newCase')}
          </button>
        </div>
      )}
    </div>
  );
}
