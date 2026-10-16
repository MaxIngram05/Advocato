import type { ChatMessage } from '../../core/model';

/** Lines starting with "- " render as a list (follow-up questions, findings). */
export function MessageBubble({ role, text }: Pick<ChatMessage, 'role' | 'text'>) {
  const lines = text.split('\n');
  const prose = lines.filter((l) => !l.startsWith('- '));
  const items = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  return (
    <li className="av-msg" data-message data-role={role}>
      {prose.map((p, i) => (
        <p key={i} style={{ margin: 0 }}>
          {p}
        </p>
      ))}
      {items.length > 0 && (
        <ul>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
