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
    return <p className="naechster-termin-leer">Kein anstehender Termin. Neue Termine legst du über „Schnell erfassen“ an.</p>;
  }

  const fach = faecher.find((f) => f.id === naechster.fach_id);
  const { wert, einheit } = restzeitGross(naechster.zeitpunkt);
  const dringend = restMillisekunden(naechster.zeitpunkt) < 48 * 60 * 60 * 1000;

  return (
    <div className={`naechster-termin ${dringend ? "naechster-termin-dringend" : ""}`}>
      <div className="naechster-termin-countdown">
        <span className="wert">{wert}</span>
        <span className="einheit">{einheit}</span>
      </div>
      <div className="naechster-termin-text">
        <p className="naechster-termin-art">
          Als Nächstes: {naechster.typ}
          {fach && (
            <>
              {", "}
              <span className="dot" style={{ background: fach.farbe ?? "var(--text-3)" }} aria-hidden />
              {fach.name}
            </>
          )}
        </p>
        <p className="naechster-termin-titel">{naechster.titel}</p>
        <p className="naechster-termin-zeit">{absolutesDatum(naechster.zeitpunkt)}</p>
      </div>
    </div>
  );
}
