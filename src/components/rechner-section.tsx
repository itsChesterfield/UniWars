"use client";

import { useMemo, useState } from "react";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Note = Tables<"note">;
type Pruefung = Tables<"pruefung">;
type LernSession = Tables<"lern_session">;

const STATUS_LABEL: Record<Enums<"pruefung_status">, string> = {
  ANSTEHEND: "Anstehend",
  BESTANDEN: "Bestanden",
  NICHT_BESTANDEN: "Nicht bestanden",
};

function summeUndGewicht(notes: Note[]) {
  return notes.reduce(
    (acc, n) => ({ summe: acc.summe + n.wert * n.gewicht, gewicht: acc.gewicht + n.gewicht }),
    { summe: 0, gewicht: 0 },
  );
}

function ZielnotenRechner({ notes }: { notes: Note[] }) {
  const [zielschnitt, setZielschnitt] = useState("2.0");
  const [verbleibendesGewicht, setVerbleibendesGewicht] = useState("1");

  const { summe, gewicht } = summeUndGewicht(notes);

  const ziel = Number(zielschnitt);
  const restGewicht = Number(verbleibendesGewicht);

  let ergebnis: string;
  if (!Number.isFinite(ziel) || !Number.isFinite(restGewicht) || restGewicht <= 0) {
    ergebnis = "Bitte gültige Werte eingeben.";
  } else {
    const zielSumme = ziel * (gewicht + restGewicht);
    const benoetigt = (zielSumme - summe) / restGewicht;
    if (benoetigt < 1) {
      ergebnis = "Ziel ist mit jeder Note erreichbar.";
    } else if (benoetigt > 5) {
      ergebnis = "Ziel ist mit den verbleibenden Prüfungen nicht mehr erreichbar.";
    } else {
      ergebnis = `Du brauchst im Schnitt ${benoetigt.toFixed(2)} auf die restlichen Prüfungen.`;
    }
  }

  return (
    <div className="rechner-karte">
      <h3>Zielnoten-Rechner</h3>
      <label htmlFor="ziel-schnitt">Zielschnitt</label>
      <input
        id="ziel-schnitt"
        type="number"
        step="0.1"
        min="1"
        max="5"
        value={zielschnitt}
        onChange={(e) => setZielschnitt(e.target.value)}
      />
      <label htmlFor="ziel-gewicht">Verbleibendes Gewicht</label>
      <input
        id="ziel-gewicht"
        type="number"
        step="0.1"
        min="0"
        value={verbleibendesGewicht}
        onChange={(e) => setVerbleibendesGewicht(e.target.value)}
      />
      <p className="rechner-ergebnis">{ergebnis}</p>
    </div>
  );
}

function WasWaereWenn({ notes }: { notes: Note[] }) {
  const [wert, setWert] = useState("2.0");
  const [gewichtNeu, setGewichtNeu] = useState("1");

  const { summe, gewicht } = summeUndGewicht(notes);

  const w = Number(wert);
  const g = Number(gewichtNeu);

  let ergebnis: string;
  if (!Number.isFinite(w) || !Number.isFinite(g) || g <= 0) {
    ergebnis = "Bitte gültige Werte eingeben.";
  } else {
    const neuerSchnitt = (summe + w * g) / (gewicht + g);
    ergebnis = `Neuer Schnitt wäre: ${neuerSchnitt.toFixed(2)}`;
  }

  return (
    <div className="rechner-karte">
      <h3>Was-wäre-wenn</h3>
      <label htmlFor="www-wert">Angenommene Note</label>
      <input
        id="www-wert"
        type="number"
        step="0.1"
        min="1"
        max="5"
        value={wert}
        onChange={(e) => setWert(e.target.value)}
      />
      <label htmlFor="www-gewicht">Gewicht</label>
      <input
        id="www-gewicht"
        type="number"
        step="0.1"
        min="0"
        value={gewichtNeu}
        onChange={(e) => setGewichtNeu(e.target.value)}
      />
      <p className="rechner-ergebnis">{ergebnis}</p>
    </div>
  );
}

function BestandenUebersicht({ pruefungen }: { pruefungen: Pruefung[] }) {
  const gruppen = useMemo(() => {
    const zaehler: Record<Enums<"pruefung_status">, number> = {
      ANSTEHEND: 0,
      BESTANDEN: 0,
      NICHT_BESTANDEN: 0,
    };
    pruefungen.forEach((p) => zaehler[p.status]++);
    return zaehler;
  }, [pruefungen]);

  return (
    <div className="rechner-karte">
      <h3>Bestanden-Übersicht</h3>
      <ul className="bestanden-liste">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <li key={status}>
            <span className={`status-marke status-${status.toLowerCase()}`} aria-hidden />
            {label}: <strong>{gruppen[status as Enums<"pruefung_status">]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PruefungsCountdown({
  pruefungen,
  faecher,
}: {
  pruefungen: Pruefung[];
  faecher: FachOption[];
}) {
  const naechste = [...pruefungen]
    .filter((p) => p.status === "ANSTEHEND")
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())[0];

  if (!naechste) {
    return (
      <div className="rechner-karte">
        <h3>Prüfungs-Countdown</h3>
        <p className="empty-state">Keine anstehende Prüfung.</p>
      </div>
    );
  }

  const fach = faecher.find((f) => f.id === naechste.fach_id);
  const diffTage = Math.ceil(
    (new Date(naechste.datum).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="rechner-karte">
      <h3>Prüfungs-Countdown</h3>
      <p className="rechner-ergebnis">
        {naechste.titel} {fach ? `(${fach.name})` : ""}
        <br />
        {diffTage <= 0 ? "heute" : `in ${diffTage} Tagen`}
      </p>
    </div>
  );
}

function LernzeitStatistik({
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

  const maxMinuten = Math.max(...proFach.map((f) => f.minuten), 1);

  return (
    <div className="rechner-karte">
      <h3>Lernzeit-Statistik</h3>
      {proFach.length === 0 ? (
        <p className="empty-state">Noch keine Lernzeit erfasst.</p>
      ) : (
        <ul className="lernzeit-liste">
          {proFach.map((f) => (
            <li key={f.fachId} className="lernzeit-zeile">
              <span className="lernzeit-name">{f.name}</span>
              <div className="lernzeit-balken-spur">
                <div
                  className="lernzeit-balken"
                  style={{ width: `${(f.minuten / maxMinuten) * 100}%`, backgroundColor: f.farbe }}
                />
              </div>
              <span className="lernzeit-wert">{Math.round(f.minuten / 60)} h</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RechnerSection({
  notes,
  pruefungen,
  lernSessions,
  faecher,
}: {
  notes: Note[];
  pruefungen: Pruefung[];
  lernSessions: LernSession[];
  faecher: FachOption[];
}) {
  return (
    <section className="crud-section">
      <h2>Rechner</h2>
      <div className="rechner-grid">
        <ZielnotenRechner notes={notes} />
        <WasWaereWenn notes={notes} />
        <BestandenUebersicht pruefungen={pruefungen} />
        <PruefungsCountdown pruefungen={pruefungen} faecher={faecher} />
        <LernzeitStatistik lernSessions={lernSessions} faecher={faecher} />
      </div>
    </section>
  );
}
