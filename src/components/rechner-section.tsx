"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { track } from "@/lib/analytics";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";
import { benoetigteNote, notenText, schnittMit, schnittProFach, zahlLesen } from "@/lib/noten";

type Note = Tables<"note">;
type Pruefung = Tables<"pruefung">;
type LernSession = Tables<"lern_session">;

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

/** Kopf der Notenseite: Schnitt groß in Mono, darunter worauf er beruht und der Stand der Prüfungen. */
export function NotenKopf({
  schnitt,
  notes,
  fachName,
  pruefungen,
}: {
  schnitt: number | null;
  notes: Note[];
  /** gesetzt, wenn nach einem Fach gefiltert ist */
  fachName?: string | null;
  pruefungen: Pruefung[];
}) {
  const zaehler = useMemo(() => {
    const z: Record<Enums<"pruefung_status">, number> = { ANSTEHEND: 0, BESTANDEN: 0, NICHT_BESTANDEN: 0 };
    pruefungen.forEach((p) => z[p.status]++);
    return z;
  }, [pruefungen]);
  const gewicht = notes.reduce((s, n) => s + n.gewicht, 0);

  return (
    <div className="noten-kopf">
      <p className="noten-schnitt zahl">
        <span className="vh">{fachName ? `Schnitt in ${fachName}: ` : "Notenschnitt: "}</span>
        {schnitt != null ? notenText(schnitt) : "–"}
      </p>
      <div className="noten-kopf-text">
        <p>
          {fachName ? `Schnitt in ${fachName}` : "Notenschnitt"} aus {notes.length}{" "}
          {notes.length === 1 ? "Note" : "Noten"}, gewichtet (Gewicht gesamt {gewicht.toLocaleString("de-DE")}).
        </p>
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

export function NotenDurchschnittProFach({
  notes,
  faecher,
}: {
  notes: Note[];
  faecher: FachOption[];
}) {
  const proFach = useMemo(
    () =>
      schnittProFach(notes)
        .map((x) => ({ ...x, fach: faecher.find((f) => f.id === x.fachId) }))
        .filter((x): x is typeof x & { fach: FachOption } => x.fach != null),
    [notes, faecher],
  );

  if (proFach.length === 0) return null;

  return (
    <section aria-labelledby="abschnitt-schnitt-fach">
      <h2 id="abschnitt-schnitt-fach" className="abschnitt-titel">
        Schnitt pro Fach
      </h2>
      <ul className="entry-list">
        {proFach.map(({ fach, schnitt, anzahl }) => (
          <li key={fach.id} className="entry-row fach-zeile">
            <span className="fach-farbe" style={{ "--c": fach.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
            <div className="entry-info">
              <span className="entry-title">{fach.name}</span>
              <span className="entry-meta">
                {anzahl} {anzahl === 1 ? "Note" : "Noten"}
              </span>
            </div>
            <span className="note-wert zahl">{notenText(schnitt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Design B3: ein Abschnitt „Rechner“ mit zwei Fragen nebeneinander, Ergebnis wird vorgelesen. */
export function NotenRechner({ notes }: { notes: Note[] }) {
  const [wennNote, setWennNote] = useState("2,0");
  const [wennGewicht, setWennGewicht] = useState("1");
  const [ziel, setZiel] = useState("2,0");
  const [restGewicht, setRestGewicht] = useState("1");
  const meldenWenn = useEinmalMelden("was_waere_wenn");
  const meldenZiel = useEinmalMelden("zielnote");

  const neu = schnittMit(notes, zahlLesen(wennNote), zahlLesen(wennGewicht));
  const bedarf = benoetigteNote(notes, zahlLesen(ziel), zahlLesen(restGewicht));

  return (
    <section className="rechner" aria-labelledby="abschnitt-rechner">
      <h2 id="abschnitt-rechner" className="abschnitt-titel">
        Rechner
      </h2>
      <div className="rechner-teile">
        <form className="rechner-teil" aria-labelledby="rechner-wenn" onSubmit={(e) => e.preventDefault()}>
          <h3 id="rechner-wenn">Was wäre, wenn</h3>
          <p className="rechner-frage">Wie ändert sich der Schnitt mit der nächsten Note?</p>
          <div className="rechner-feld">
            <label>
              Note
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
              Gewicht
              <input
                inputMode="decimal"
                value={wennGewicht}
                aria-describedby="rechner-wenn-erg"
                onChange={(e) => {
                  meldenWenn();
                  setWennGewicht(e.target.value);
                }}
              />
            </label>
          </div>
          <p id="rechner-wenn-erg" className="rechner-erg" aria-live="polite">
            {neu != null ? (
              <>
                Neuer Schnitt <b className="zahl">{notenText(neu, 2)}</b>
              </>
            ) : (
              "Note zwischen 1,0 und 5,0 und ein Gewicht über 0 eingeben."
            )}
          </p>
        </form>

        <form className="rechner-teil" aria-labelledby="rechner-ziel" onSubmit={(e) => e.preventDefault()}>
          <h3 id="rechner-ziel">Zielschnitt</h3>
          <p className="rechner-frage">Was brauchst du auf die restlichen Prüfungen?</p>
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
              Restliches Gewicht
              <input
                inputMode="decimal"
                value={restGewicht}
                aria-describedby="rechner-ziel-erg"
                onChange={(e) => {
                  meldenZiel();
                  setRestGewicht(e.target.value);
                }}
              />
            </label>
          </div>
          <p id="rechner-ziel-erg" className="rechner-erg" aria-live="polite">
            {bedarf.art === "note" ? (
              <>
                Du brauchst im Schnitt <b className="zahl">{notenText(bedarf.wert, 2)}</b> oder besser.
              </>
            ) : bedarf.art === "sicher" ? (
              "Das Ziel erreichst du mit jeder Note."
            ) : bedarf.art === "unmoeglich" ? (
              "Mit dem restlichen Gewicht ist das Ziel nicht mehr erreichbar."
            ) : (
              "Ziel zwischen 1,0 und 5,0 und ein Gewicht über 0 eingeben."
            )}
          </p>
        </form>
      </div>
    </section>
  );
}

export function LernzeitStatistik({
  lernSessions,
  faecher,
}: {
  lernSessions: LernSession[];
  faecher: FachOption[];
}) {
  const proFach = useMemo(() => {
    const summen = new Map<string, number>();
    lernSessions.forEach((s) => {
      const key = s.fach_id ?? "ohne-fach";
      summen.set(key, (summen.get(key) ?? 0) + s.dauer_minuten);
    });
    return [...summen.entries()]
      .map(([fachId, minuten]) => ({
        fachId,
        name: faecher.find((f) => f.id === fachId)?.name ?? "Ohne Fach",
        farbe: faecher.find((f) => f.id === fachId)?.farbe ?? "#94a3b8",
        minuten,
      }))
      .sort((a, b) => b.minuten - a.minuten);
  }, [lernSessions, faecher]);

  const gesamtMinuten = proFach.reduce((sum, f) => sum + f.minuten, 0);
  const maxMinuten = Math.max(...proFach.map((f) => f.minuten), 1);

  if (proFach.length === 0) {
    return <p className="empty-state">Noch keine Lernzeit erfasst.</p>;
  }

  return (
    <div className="lernzeit-balken-reihe">
      {proFach.map((f) => (
        <div key={f.fachId} className="lernzeit-saeule">
          <span className="lernzeit-saeule-wert">{Math.round((f.minuten / 60) * 10) / 10} h</span>
          <div
            className="lernzeit-saeule-balken"
            style={{ height: Math.max((f.minuten / maxMinuten) * 120, 6), backgroundColor: f.farbe }}
          />
          <span className="lernzeit-saeule-name">{f.name}</span>
        </div>
      ))}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "10px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, paddingBottom: 24 }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Gesamt</span>
        <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 700 }}>
          {Math.round(gesamtMinuten / 60)} h
        </span>
      </div>
    </div>
  );
}
