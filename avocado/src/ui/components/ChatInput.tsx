import { useId, useState, type FormEvent } from 'react';
import { useT } from '../i18n';

export function ChatInput({ onSend, disabled = false }: { onSend: (text: string) => void; disabled?: boolean }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  };
  return (
    <form className="av-composer" onSubmit={submit}>
      <label htmlFor={id} className="av-visually-hidden">
        {t('chat.input')}
      </label>
      <textarea
        id={id}
        value={text}
        placeholder={t('chat.placeholder')}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
      />
      <button type="submit" disabled={disabled}>
        {t('chat.send')}
      </button>
    </form>
  );
}
