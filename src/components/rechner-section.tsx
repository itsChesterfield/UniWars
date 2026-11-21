"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { track } from "@/lib/analytics";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";
import { gesamtMitModul, notenText, zahlLesen, zielnoteNachEcts, type Gesamtnote } from "@/lib/noten";
import { RollText } from "@/components/bewegung/roll-text";

type Pruefung = Tables<"pruefung">;

const STATUS_LABEL: Record<Enums<"pruefung_status">, string> = {
  ANSTEHEND: "Anstehend",
  BESTANDEN: "Bestanden",
  NICHT_BESTANDEN: "Nicht bestanden",
};

function useEinmalMelden(rechner: string) {
  const gemeldet = useRef(false);
  return () => {
    if (gemeldet.current) return;
    gemeldet.current = true;
    track("rechner_benutzt", { rechner });
  };
}

/** Wie die Noten verrechnet werden, in einem Satz für unter den Schnitt. */
const REGEL = "Wie in den meisten Prüfungsordnungen nach der ersten Stelle abgeschnitten, nicht gerundet. Maßgeblich ist deine Prüfungsordnung.";

/** Kopf der Notenseite: Gesamtnote (oder Modulnote im Fach-Filter) groß, darunter worauf sie beruht. */
export function NotenKopf({
  gesamt,
  fachName,
  fachNamen,
  pruefungen,
}: {
  gesamt: Gesamtnote;
  /** gesetzt, wenn nach einem Fach gefiltert ist */
  fachName?: string | null;
  fachNamen: (id: string) => string;
  pruefungen: Pruefung[];
}) {
  const zaehler = useMemo(() => {
    const z: Record<Enums<"pruefung_status">, number> = { ANSTEHEND: 0, BESTANDEN: 0, NICHT_BESTANDEN: 0 };
    pruefungen.forEach((p) => z[p.status]++);
    return z;
  }, [pruefungen]);
  const modul = fachName ? gesamt.module[0] : null;
  const anzahlModule = gesamt.module.filter((m) => m.note !== null).length;
  const liste = (ids: string[]) => ids.map(fachNamen).join(", ");

  return (
    <div className="noten-kopf">
      {/* Die Note selbst steht schon groß im Bereichskopf (Aufgabe 4, B2) */}
      <div className="noten-kopf-text">
        {modul ? (
          <p>
            Modulnote in {fachName} aus {modul.teile} {modul.teile === 1 ? "Note" : "Noten"}
            {modul.vorlaeufig ? ", vorläufig" : ""}
            {modul.ects ? `, zählt mit ${modul.ects.toLocaleString("de-DE")} ECTS` : ""}.
          </p>
        ) : gesamt.nachEcts ? (
          <p>
            Gesamtnote aus {anzahlModule} {anzahlModule === 1 ? "Modul" : "Modulen"}, nach ECTS gewichtet ({gesamt.ects.toLocaleString("de-DE")} ECTS).
          </p>
        ) : (
          <p>Schnitt nach dem Anteil deiner Noten. Trag bei deinen Fächern ECTS ein, dann rechnet UniVerse wie deine Uni.</p>
        )}
        <p className="noten-status">{REGEL}</p>
        {!modul && gesamt.ohneEcts.length > 0 && <p className="noten-status">Zählt noch nicht, weil ECTS fehlen: {liste(gesamt.ohneEcts)}.</p>}
        {!modul && gesamt.nichtBestanden.length > 0 && <p className="noten-status">Nicht bestanden, zählt nicht: {liste(gesamt.nichtBestanden)}.</p>}
        {pruefungen.length > 0 && (
          <p className="noten-status">
            Prüfungen:{" "}
            {(Object.keys(STATUS_LABEL) as Enums<"pruefung_status">[])
              .filter((st) => zaehler[st] > 0)
              .map((st) => `${zaehler[st]} ${STATUS_LABEL[st].toLowerCase()}`)
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Modulnote je Fach: Teilnoten nach Anteil, dazu die ECTS, mit denen das Modul zählt. */
export function NotenDurchschnittProFach({ gesamt, faecher }: { gesamt: Gesamtnote; faecher: FachOption[] }) {
  const proFach = useMemo(
    () =>
      gesamt.module
        .filter((m): m is typeof m & { note: number } => m.note !== null)
        .map((m) => ({ ...m, fach: faecher.find((f) => f.id === m.fachId) }))
        .filter((x): x is typeof x & { fach: FachOption } => x.fach != null)
        .sort((a, b) => a.note - b.note),
    [gesamt, faecher],
  );

  if (proFach.length === 0) return null;

  return (
    <section aria-labelledby="abschnitt-schnitt-fach">
      <h2 id="abschnitt-schnitt-fach" className="abschnitt-titel">
        Modulnoten
      </h2>
      <ul className="entry-list">
        {proFach.map(({ fach, note, teile, ects, vorlaeufig }) => (
          <li key={fach.id} className="entry-row fach-zeile">
            <span className="fach-farbe" style={{ "--c": fach.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
            <div className="entry-info">
              <span className="entry-title">{fach.name}</span>
              <span className="entry-meta">
                {[
                  `${teile} ${teile === 1 ? "Note" : "Noten"}`,
                  gesamt.nachEcts ? (ects ? `${ects.toLocaleString("de-DE")} ECTS` : "ohne ECTS") : null,
                  vorlaeufig ? "vorläufig" : null,
                  note > 4 ? "nicht bestanden" : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
            <span className="note-wert zahl">
              <RollText wert={notenText(note)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Design B3: ein Abschnitt „Rechner“ mit zwei Fragen nebeneinander, Ergebnis wird vorgelesen. Rechnet mit ECTS. */
export function NotenRechner({ gesamt, offeneEcts }: { gesamt: Gesamtnote; offeneEcts: { naechstes: number | null; summe: number } }) {
  const [wennNote, setWennNote] = useState("2,0");
  const [wennEcts, setWennEcts] = useState(String(offeneEcts.naechstes ?? 5));
  const [ziel, setZiel] = useState(gesamt.wert ? notenText(gesamt.wert) : "2,0");
  const [restEcts, setRestEcts] = useState(String(offeneEcts.summe || 30));
  const meldenWenn = useEinmalMelden("was_waere_wenn");
  const meldenZiel = useEinmalMelden("zielnote");

  const neu = gesamtMitModul(gesamt, zahlLesen(wennNote), zahlLesen(wennEcts));
  const bedarf = zielnoteNachEcts(gesamt, zahlLesen(ziel), zahlLesen(restEcts));

  return (
    // Zugeklappt, damit die Notenseite mit den Noten beginnt (Aufgabe 4, B2)
    <details className="rechner">
      <summary>
        <h2 id="abschnitt-rechner" className="abschnitt-titel">
          Rechner
        </h2>
        <span className="abschnitt-info">Was wäre, wenn und Zielnote</span>
      </summary>
      <div className="rechner-teile">
        <form className="rechner-teil" aria-labelledby="rechner-wenn" onSubmit={(e) => e.preventDefault()}>
          <h3 id="rechner-wenn">Was wäre, wenn</h3>
          <p className="rechner-frage">Wie ändert sich die Gesamtnote mit dem nächsten Modul?</p>
          <div className="rechner-feld">
            <label>
              Modulnote
              <input
                inputMode="decimal"
                value={wennNote}
                aria-describedby="rechner-wenn-erg"
                onChange={(e) => {
                  meldenWenn();
                  setWennNote(e.target.value);
                }}
              />
            </label>
            <label>
              ECTS
              <input
                inputMode="decimal"
                value={wennEcts}
                aria-describedby="rechner-wenn-erg"
                onChange={(e) => {
                  meldenWenn();
                  setWennEcts(e.target.value);
                }}
              />
            </label>
          </div>
          <p id="rechner-wenn-erg" className="rechner-erg" aria-live="polite">
            {neu != null ? (
              <>
                Neue Gesamtnote <b className="zahl">{notenText(neu)}</b>
              </>
            ) : (
              "Note zwischen 1,0 und 4,0 und ECTS über 0 eingeben."
            )}
          </p>
        </form>

        <form className="rechner-teil" aria-labelledby="rechner-ziel" onSubmit={(e) => e.preventDefault()}>
          <h3 id="rechner-ziel">Zielnote</h3>
          <p className="rechner-frage">Was brauchst du in den Modulen, die noch fehlen?</p>
          <div className="rechner-feld">
            <label>
              Ziel
              <input
                inputMode="decimal"
                value={ziel}
                aria-describedby="rechner-ziel-erg"
                onChange={(e) => {
                  meldenZiel();
                  setZiel(e.target.value);
                }}
              />
            </label>
            <label>
              Restliche ECTS
              <input
                inputMode="decimal"
                value={restEcts}
                aria-describedby="rechner-ziel-erg"
                onChange={(e) => {
                  meldenZiel();
                  setRestEcts(e.target.value);
                }}
              />
            </label>
          </div>
          <p id="rechner-ziel-erg" className="rechner-erg" aria-live="polite">
            {bedarf.art === "note" ? (
              <>
                Du brauchst im Schnitt <b className="zahl">{notenText(bedarf.wert)}</b> oder besser.
              </>
            ) : bedarf.art === "sicher" ? (
              "Das Ziel erreichst du mit jeder bestandenen Note."
            ) : bedarf.art === "unmoeglich" ? (
              "Mit den restlichen ECTS ist das Ziel nicht mehr erreichbar."
            ) : (
              "Ziel zwischen 1,0 und 4,0 und ECTS über 0 eingeben."
            )}
          </p>
        </form>
      </div>
    </details>
  );
}
