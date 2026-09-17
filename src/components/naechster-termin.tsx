"use client";

import { restMillisekunden, restzeitGross, absolutesDatum } from "@/lib/countdown";
import type { Tables } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Deadline = Tables<"deadline">;
type Pruefung = Tables<"pruefung">;

export function NaechsterTermin({
  deadlines,
  pruefungen,
  faecher,
}: {
  deadlines: Deadline[];
  pruefungen: Pruefung[];
  faecher: FachOption[];
}) {
  const kandidaten = [
    ...deadlines
      .filter((d) => !d.erledigt)
      .map((d) => ({
        typ: "Deadline" as const,
        titel: d.titel,
        zeitpunkt: d.faellig_am,
        fach_id: d.fach_id,
      })),
    ...pruefungen
      .filter((p) => p.status === "ANSTEHEND")
      .map((p) => ({
        typ: "Prüfung" as const,
        titel: p.titel,
        zeitpunkt: p.datum,
        fach_id: p.fach_id as string | null,
      })),
  ].sort((a, b) => new Date(a.zeitpunkt).getTime() - new Date(b.zeitpunkt).getTime());

  const naechster = kandidaten[0];

  if (!naechster) {
    return (
      <div className="naechster-termin naechster-termin-leer">
        <span className="muted">Kein anstehender Termin.</span>
      </div>
    );
  }

  const fach = faecher.find((f) => f.id === naechster.fach_id);
  const { wert, einheit } = restzeitGross(naechster.zeitpunkt);
  const dringend = restMillisekunden(naechster.zeitpunkt) < 48 * 60 * 60 * 1000;

  return (
    <div className={`naechster-termin ${dringend ? "naechster-termin-dringend" : ""}`}>
      <div className={`naechster-termin-countdown ${dringend ? "entry-countdown-dringend" : ""}`}>
        <span className="entry-countdown-wert" style={{ fontSize: 30 }}>{wert}</span>
        <span className="entry-countdown-einheit">{einheit}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="tag">{naechster.typ}</span>
          {fach && (
            <span className="row muted" style={{ gap: 6, fontSize: 12 }}>
              <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} />
              {fach.name}
            </span>
          )}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, marginTop: 3 }}>{naechster.titel}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{absolutesDatum(naechster.zeitpunkt)}</div>
      </div>
    </div>
  );
}
