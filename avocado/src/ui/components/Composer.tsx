import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '../i18n';

export const ACCEPTED_UPLOADS =
  '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

/** Copilot-style input: paperclip (always available), multiline text, send. */
export function Composer({
  onSend,
  onFiles,
  disabled = false,
  placeholder,
}: {
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Grow with the content (up to the CSS max-height, then scroll inside).
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  };
  return (
    <form
      className="av-composer"
      onSubmit={submit}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED_UPLOADS}
        className="av-file"
        aria-label={t('upload.add')}
        tabIndex={-1}
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <label htmlFor={id} className="av-visually-hidden">
        {t('chat.input')}
      </label>
      <textarea
        ref={areaRef}
        id={id}
        rows={1}
        value={text}
        placeholder={placeholder ?? t('chat.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
      />
      <button type="button" className="av-icon-btn" aria-label={t('upload.add')} title={t('upload.add')} onClick={() => fileRef.current?.click()}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <button type="submit" className="av-send" disabled={disabled || !text.trim()} aria-label={t('chat.send')}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </form>
  );
}
