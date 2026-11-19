"use client";

import { useEffect, useRef, useState } from "react";
import type { FachOption } from "@/lib/fach-option";

/** KK-01: Fenster mit Name (Pflicht) und Fach (optional). */
export function StapelDialog({
  titel,
  knopf,
  faecher,
  startName = "",
  startFachId = null,
  mehrfach = false,
  namePflicht = true,
  onSpeichern,
  onSchliessen,
}: {
  titel: string;
  knopf: string;
  faecher: FachOption[];
  startName?: string;
  startFachId?: string | null;
  mehrfach?: boolean;
  namePflicht?: boolean;
  onSpeichern: (name: string, fachId: string | null, weitereFaecher?: string[]) => Promise<void>;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(startName);
  const [fachId, setFachId] = useState(startFachId ?? "");
  const [fachIds, setFachIds] = useState(startFachId ? [startFachId] : []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (namePflicht && !name.trim()) {
      setFehler("Bitte gib einen Namen ein.");
      return;
    }
    setLaeuft(true);
    try {
      if (mehrfach) await onSpeichern(name.trim(), fachIds[0] ?? null, fachIds.slice(1));
      else await onSpeichern(name.trim(), fachId || null);
    } catch {
      setFehler("Speichern hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="formular-dialog"
      aria-labelledby="stapel-dialog-titel"
      onCancel={(e) => {
        e.preventDefault();
        if (!laeuft) onSchliessen();
      }}
    >
      <form onSubmit={absenden} className="crud-form">
        <h3 id="stapel-dialog-titel">{titel}</h3>
        {namePflicht && <>
          <label htmlFor="stapel-name">Name</label>
          <input id="stapel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required disabled={laeuft} />
        </>}
        {mehrfach ? <fieldset disabled={laeuft}>
          <legend>Fächer in der Dateiablage</legend>
          {faecher.length === 0 && <p>Du hast noch keine Fächer angelegt.</p>}
          {faecher.map((f) => <label key={f.id} className="dat-workflow-mitglied">
            <input type="checkbox" checked={fachIds.includes(f.id)} onChange={(e) => {
              const aktiv = e.target.checked;
              setFachIds((alt) => aktiv ? [...alt, f.id] : alt.filter((id) => id !== f.id));
            }} />
            {f.name}
          </label>)}
        </fieldset> : <>
          <label htmlFor="stapel-fach">Fach (optional)</label>
          <select id="stapel-fach" value={fachId} onChange={(e) => setFachId(e.target.value)}>
            <option value="">Ohne Fach</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </>}
        {fehler && (
          <p className="formular-fehler" role="alert">
            {fehler}
          </p>
        )}
        <div className="crud-form-actions">
          <button type="submit" className="knopf haupt" aria-busy={laeuft} disabled={laeuft}>
            {knopf}
          </button>
          <button type="button" className="knopf leise" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  );
}
