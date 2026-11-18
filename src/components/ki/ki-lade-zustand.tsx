import { Umlauf } from "@/components/bewegung/umlauf";

/** Ladeanzeige während die KI arbeitet. */
export function KiLadeZustand({ text, untertext }: { text: string; untertext?: string }) {
  return (
    <div className="ki-mitte ki-laedt" role="status">
      <Umlauf groesse={64} />
      <p>{text}</p>
      {untertext && <p className="muted">{untertext}</p>}
    </div>
  );
}
