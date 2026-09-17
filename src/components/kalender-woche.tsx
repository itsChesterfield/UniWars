"use client";

import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Eintrag = Tables<"stundenplan_eintrag">;
type Deadline = Tables<"deadline">;
type Pruefung = Tables<"pruefung">;

const TAGE: Enums<"wochentag">[] = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const TAG_LABEL: Record<Enums<"wochentag">, string> = {
  MO: "Mo",
  DI: "Di",
  MI: "Mi",
  DO: "Do",
  FR: "Fr",
  SA: "Sa",
  SO: "So",
};
const JS_TAG_ZU_WOCHENTAG: Record<number, Enums<"wochentag">> = {
  0: "SO",
  1: "MO",
  2: "DI",
  3: "MI",
  4: "DO",
  5: "FR",
  6: "SA",
};

const BASIS_STUNDE = 8;
const END_STUNDE = 20;
const PX_PRO_MINUTE = 1;
const RASTER_HOEHE = (END_STUNDE - BASIS_STUNDE) * 60 * PX_PRO_MINUTE;

function minutenSeitBasis(stunde: number, minute: number): number {
  return (stunde - BASIS_STUNDE) * 60 + minute;
}

function positionFuerZeitpunkt(dt: Date): number {
  const minuten = minutenSeitBasis(dt.getHours(), dt.getMinutes());
  return Math.min(Math.max(minuten, 0), RASTER_HOEHE - 20);
}

function montagDieserWoche(datum: Date): Date {
  const wochentag = datum.getDay();
  const diffZuMontag = wochentag === 0 ? -6 : 1 - wochentag;
  const montag = new Date(datum);
  montag.setDate(datum.getDate() + diffZuMontag);
  montag.setHours(0, 0, 0, 0);
  return montag;
}

export function KalenderWoche({
  stundenplanEintraege,
  deadlines,
  pruefungen,
  faecher,
}: {
  stundenplanEintraege: Eintrag[];
  deadlines: Deadline[];
  pruefungen: Pruefung[];
  faecher: FachOption[];
}) {
  const montag = montagDieserWoche(new Date());
  const sonntag = new Date(montag);
  sonntag.setDate(montag.getDate() + 6);
  sonntag.setHours(23, 59, 59, 999);

  const deadlinesDieseWoche = deadlines.filter((d) => {
    const dt = new Date(d.faellig_am);
    return dt >= montag && dt <= sonntag;
  });
  const pruefungenDieseWoche = pruefungen.filter((p) => {
    const dt = new Date(p.datum);
    return dt >= montag && dt <= sonntag;
  });

  const stunden = Array.from(
    { length: END_STUNDE - BASIS_STUNDE + 1 },
    (_, i) => BASIS_STUNDE + i,
  );

  return (
    <section className="crud-section">
      <h2>Kalender — diese Woche</h2>
      <div className="stundenplan-grid" style={{ height: RASTER_HOEHE + 24 }}>
        <div className="stundenplan-stunden">
          {stunden.map((h) => (
            <div key={h} className="stundenplan-stunde" style={{ height: 60 * PX_PRO_MINUTE }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {TAGE.map((tag, index) => {
          const tagesDatum = new Date(montag);
          tagesDatum.setDate(montag.getDate() + index);

          return (
            <div key={tag} className="stundenplan-tag-spalte">
              <div className="stundenplan-tag-label">
                {TAG_LABEL[tag]} {tagesDatum.getDate()}.{tagesDatum.getMonth() + 1}.
              </div>
              <div className="stundenplan-tag-body" style={{ height: RASTER_HOEHE }}>
                {stundenplanEintraege
                  .filter((e) => e.tag === tag)
                  .map((e) => {
                    const fach = faecher.find((f) => f.id === e.fach_id);
                    const [sh, sm] = e.start_zeit.split(":").map(Number);
                    const [eh, em] = e.end_zeit.split(":").map(Number);
                    const top = minutenSeitBasis(sh, sm);
                    const hoehe = minutenSeitBasis(eh, em) - top;
                    return (
                      <div
                        key={e.id}
                        className="stundenplan-block"
                        style={{
                          top,
                          height: Math.max(hoehe, 24),
                          backgroundColor: fach?.farbe ?? "#3b82f6",
                        }}
                      >
                        <span className="stundenplan-block-fach">{fach?.name}</span>
                      </div>
                    );
                  })}

                {deadlinesDieseWoche
                  .filter((d) => JS_TAG_ZU_WOCHENTAG[new Date(d.faellig_am).getDay()] === tag)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="kalender-marker kalender-marker-deadline"
                      style={{ top: positionFuerZeitpunkt(new Date(d.faellig_am)) }}
                      title={d.titel}
                    >
                      ⚑ {d.titel}
                    </div>
                  ))}

                {pruefungenDieseWoche
                  .filter((p) => JS_TAG_ZU_WOCHENTAG[new Date(p.datum).getDay()] === tag)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="kalender-marker kalender-marker-pruefung"
                      style={{ top: positionFuerZeitpunkt(new Date(p.datum)) }}
                      title={p.titel}
                    >
                      ✎ {p.titel}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
