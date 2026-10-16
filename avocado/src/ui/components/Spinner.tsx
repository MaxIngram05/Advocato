/** Loading wheel (avocado palette); the label is announced to screen readers. */
export function Spinner({ label }: { label: string }) {
  return (
    <div className="av-spinner-row" role="status" aria-live="polite">
      <span className="av-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
