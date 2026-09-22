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

export function NotenDurchschnittProFach({
  notes,
  faecher,
}: {
  notes: Note[];
  faecher: FachOption[];
}) {
  const proFach = useMemo(() => {
    const gruppen = new Map<string, { summe: number; gewicht: number }>();
    notes.forEach((n) => {
      const g = gruppen.get(n.fach_id) ?? { summe: 0, gewicht: 0 };
      g.summe += n.wert * n.gewicht;
      g.gewicht += n.gewicht;
      gruppen.set(n.fach_id, g);
    });
    return [...gruppen.entries()]
      .map(([fachId, g]) => ({
        fach: faecher.find((f) => f.id === fachId),
        schnitt: g.gewicht > 0 ? g.summe / g.gewicht : null,
      }))
      .filter((x): x is { fach: FachOption; schnitt: number } => x.fach != null && x.schnitt != null)
      .sort((a, b) => a.schnitt - b.schnitt);
  }, [notes, faecher]);

  if (proFach.length === 0) {
    return <p className="empty-state">Noch keine Noten erfasst.</p>;
  }

  return (
    <ul className="fach-list">
      {proFach.map(({ fach, schnitt }) => (
        <li key={fach.id} className="fach-card">
          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} aria-hidden />
          <div className="fach-card-info">
            <span className="fach-card-name">{fach.name}</span>
          </div>
          <span style={{ fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>
            Ø {schnitt.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NotenPrognose({ notenschnitt, notes }: { notenschnitt: number | null; notes: Note[] }) {
  if (notenschnitt == null || notes.length === 0) {
    return <p className="empty-state">Noch keine Noten für eine Prognose.</p>;
  }

  const anteil = Math.max(0, Math.min(1, (5 - notenschnitt) / 4));

  return (
    <div>
      <div className="row" style={{ gap: 18, alignItems: "flex-end", marginTop: 8 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Aktueller Schnitt</div>
          <div style={{ fontFamily: "var(--font-mono), monospace", color: "var(--accent-strong)", fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
            Ø {notenschnitt.toFixed(1)}
          </div>
        </div>
      </div>
      <div className="progress-track" style={{ marginTop: 20 }}>
        <div className="progress-fill" style={{ width: `${anteil * 100}%` }} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Beruht auf {notes.length} {notes.length === 1 ? "eingetragenen Note" : "eingetragenen Noten"}.
        Aktualisiert sich mit jeder neuen Note.
      </p>
    </div>
  );
}

export function ZielnotenRechner({ notes }: { notes: Note[] }) {
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
      <label htmlFor="ziel-schnitt">Zielschnitt</label>
      <input
        id="ziel-schnitt"
        className="field"
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
        className="field"
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

export function WasWaereWenn({ notes }: { notes: Note[] }) {
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
      <label htmlFor="www-wert">Angenommene Note</label>
      <input
        id="www-wert"
        type="range"
        min="1"
        max="5"
        step="0.1"
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        style={{ width: "100%", accentColor: "var(--accent)", marginBottom: 4 }}
      />
      <label htmlFor="www-gewicht">Gewicht</label>
      <input
        id="www-gewicht"
        className="field"
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

export function BestandenUebersicht({ pruefungen }: { pruefungen: Pruefung[] }) {
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
    <ul className="bestanden-liste">
      {Object.entries(STATUS_LABEL).map(([status, label]) => (
        <li key={status}>
          <span className={`status-marke status-${status.toLowerCase()}`} aria-hidden />
          {label}: <strong>{gruppen[status as Enums<"pruefung_status">]}</strong>
        </li>
      ))}
    </ul>
  );
}

export function PruefungsCountdown({
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
    return <p className="empty-state">Keine anstehende Prüfung.</p>;
  }

  const fach = faecher.find((f) => f.id === naechste.fach_id);
  const diffTage = Math.ceil(
    (new Date(naechste.datum).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="rowb" style={{ padding: "13px 15px", borderRadius: 12, background: "var(--accent-soft)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{naechste.titel}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{fach?.name}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--accent-strong)" }}>
          {diffTage <= 0 ? "heute" : diffTage}
        </div>
        {diffTage > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-strong)" }}>Tage</div>}
      </div>
    </div>
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
