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
  onSpeichern,
  onSchliessen,
}: {
  titel: string;
  knopf: string;
  faecher: FachOption[];
  startName?: string;
  startFachId?: string | null;
  onSpeichern: (name: string, fachId: string | null) => Promise<void>;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(startName);
  const [fachId, setFachId] = useState(startFachId ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFehler("Bitte gib einen Namen ein.");
      return;
    }
    setLaeuft(true);
    try {
      await onSpeichern(name.trim(), fachId || null);
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
        onSchliessen();
      }}
    >
      <form onSubmit={absenden} className="crud-form">
        <h3 id="stapel-dialog-titel">{titel}</h3>
        <label htmlFor="stapel-name">Name</label>
        <input id="stapel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required />
        <label htmlFor="stapel-fach">Fach (optional)</label>
        <select id="stapel-fach" value={fachId} onChange={(e) => setFachId(e.target.value)}>
          <option value="">Ohne Fach</option>
          {faecher.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {fehler && (
          <p className="formular-fehler" role="alert">
            {fehler}
          </p>
        )}
        <div className="crud-form-actions">
          <button type="submit" className="knopf haupt" aria-busy={laeuft} disabled={laeuft}>
            {knopf}
          </button>
          <button type="button" className="knopf leise" onClick={onSchliessen}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  );
}
