"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/nav-icon";

export type QuellOption = { art: "pdf" | "notiz"; id: string; titel: string; fach_id: string | null };
export type Fach = { id: string; name: string; farbe?: string | null };
export type QuellWahl = { fachId: string | null; quellen: { art: "pdf" | "notiz"; id: string }[] };

/** Material fürs Quiz/den Podcast: Fach wählen (alle Quellen vorausgewählt) und/oder einzelne PDFs und Notizen */
export function QuellenWahl({
  faecher,
  optionen,
  wert,
  onAendern,
}: {
  faecher: Fach[];
  optionen: QuellOption[];
  wert: QuellWahl;
  onAendern: (w: QuellWahl) => void;
}) {
  const id = useId();
  const [suche, setSuche] = useState("");
  const sichtbar = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return optionen.filter((o) => (!wert.fachId || o.fach_id === wert.fachId) && (!s || o.titel.toLowerCase().includes(s)));
  }, [optionen, suche, wert.fachId]);
  const gewaehlt = new Set(wert.quellen.map((q) => q.id));

  function fachWaehlen(fachId: string) {
    const id = fachId || null;
    onAendern({ fachId: id, quellen: id ? optionen.filter((o) => o.fach_id === id).map((o) => ({ art: o.art, id: o.id })) : [] });
  }

  function umschalten(o: QuellOption) {
    onAendern({ ...wert, quellen: gewaehlt.has(o.id) ? wert.quellen.filter((q) => q.id !== o.id) : [...wert.quellen, { art: o.art, id: o.id }] });
  }

  return (
    <>
      <label htmlFor={`${id}-fach`}>Fach</label>
      <select id={`${id}-fach`} value={wert.fachId ?? ""} onChange={(e) => fachWaehlen(e.target.value)}>
        <option value="">Alle Fächer (einzeln auswählen)</option>
        {faecher.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-suche`}>Quellen</label>
      <input id={`${id}-suche`} type="search" placeholder="PDFs und Notizen durchsuchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      <div className="qz-quellen-liste" role="group" aria-label="Quellen">
        {sichtbar.length === 0 && <p className="qz-hinweis">Keine PDFs oder Notizen gefunden.</p>}
        {sichtbar.map((o) => (
          <label key={o.id} className="qz-quelle">
            <input type="checkbox" checked={gewaehlt.has(o.id)} onChange={() => umschalten(o)} />
            <Icon name={o.art === "pdf" ? "pdf" : "notizen"} groesse={16} />
            <span>{o.titel}</span>
          </label>
        ))}
      </div>
      <span className="qz-hinweis">
        <span className="zahl">{wert.quellen.length}</span> ausgewählt
      </span>
    </>
  );
}
