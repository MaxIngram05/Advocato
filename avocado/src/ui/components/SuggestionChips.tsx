export interface Chip {
  id: string;
  label: string;
}

export function SuggestionChips({ chips, onPick, label }: { chips: Chip[]; onPick: (id: string) => void; label: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="av-chips" role="group" aria-label={label}>
      {chips.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
