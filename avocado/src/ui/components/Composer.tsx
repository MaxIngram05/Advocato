import { useId, useRef, useState, type FormEvent } from 'react';
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
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles([...e.dataTransfer.files]);
      }}
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
        📎
      </button>
      <button type="submit" className="av-send" disabled={disabled || !text.trim()} aria-label={t('chat.send')}>
        ↑
      </button>
    </form>
  );
}
