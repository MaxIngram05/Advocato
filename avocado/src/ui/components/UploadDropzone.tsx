import { useId, useState } from 'react';
import type { Exhibit } from '../../core/model';
import { useT } from '../i18n';

export const ACCEPTED_UPLOADS =
  '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export interface UploadDropzoneProps {
  exhibits: Exhibit[];
  problems: string[];
  busy: boolean;
  onFiles: (files: File[]) => void;
  onUseSelection: () => void;
}

/** US-03: file picker, drop target and "use document selection". */
export function UploadDropzone({ exhibits, problems, busy, onFiles, onUseSelection }: UploadDropzoneProps) {
  const t = useT();
  const id = useId();
  const [dragging, setDragging] = useState(false);
  return (
    <section
      className="av-panel"
      aria-labelledby={`${id}-title`}
      aria-busy={busy}
      data-dragging={dragging || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <h2 id={`${id}-title`} className="av-visually-hidden">{t('upload.title')}</h2>
      <div className="av-field">
        <label htmlFor={`${id}-files`} className="av-attach">📎 {t('upload.add')}</label>
        <input
          id={`${id}-files`}
          type="file"
          multiple
          accept={ACCEPTED_UPLOADS}
          className="av-file"
          disabled={busy}
          onChange={(e) => {
            onFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      <button type="button" onClick={onUseSelection} disabled={busy}>
        {t('upload.useSelection')}
      </button>
      {problems.map((p) => (
        <p key={p} role="alert" className="av-alert" data-severity="warning">
          ⚠ {p}
        </p>
      ))}
      {exhibits.length > 0 && (
        <ul aria-label={t('upload.exhibits')}>
          {exhibits.map((e) => (
            <li key={e.id}>
              {e.id} — {e.name}
              {e.ocr ? ` (${t('upload.ocr')})` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
