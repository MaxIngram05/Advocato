import type { ReactNode } from 'react';
import type { ChatMessage } from '../../core/model';
import { useT } from '../i18n';
import { MessageBubble } from './MessageBubble';

export function ChatThread({ messages, lead }: { messages: ChatMessage[]; lead?: ReactNode }) {
  const t = useT();
  return (
    <div className="av-thread" role="log" aria-live="polite" aria-label={t('chat.label')}>
      <ul>
        {lead}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} />
        ))}
      </ul>
    </div>
  );
}
