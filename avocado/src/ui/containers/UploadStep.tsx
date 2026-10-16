import type { CaseFile } from '../../core/model';
import { useT } from '../i18n';

/** The exhibits received so far; facts are extracted automatically, this only offers a retry. */
export function UploadStep({ caseFile, busy, onRetry }: { caseFile: CaseFile; busy: boolean; onRetry: () => void }) {
  const t = useT();
  if (caseFile.exhibits.length === 0) return null;
  const pending = caseFile.exhibits.some((e) => !e.factsExtracted);
  return (
    <div className="av-card">
      <ul className="av-exhibits" aria-label={t('upload.exhibits')}>
        {caseFile.exhibits.map((e) => (
          <li key={e.id}>
            <span className="av-exhibit-id">{e.id}</span> {e.name}
            {e.ocr ? ` (${t('upload.ocr')})` : ''}
            {e.factsExtracted ? ' ✓' : ''}
          </li>
        ))}
      </ul>
      {pending && !busy && (
        <button type="button" className="av-primary" onClick={onRetry}>
          {t('upload.analyse')}
        </button>
      )}
    </div>
  );
}
