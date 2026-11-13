/** Ladeanzeige während die KI arbeitet. */
export function KiLadeZustand({ text, untertext }: { text: string; untertext?: string }) {
  return (
    <div className="ki-mitte ki-laedt" role="status">
      <span className="ki-spinner" aria-hidden />
      <p>{text}</p>
      {untertext && <p className="muted">{untertext}</p>}
    </div>
  );
}
