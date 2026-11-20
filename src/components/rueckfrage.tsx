"use client";

import { useEffect, useId, useRef, useState } from "react";

export type RueckfrageOptionen = {
  /** Frage als Überschrift, z. B. „Quelle löschen?“ */
  titel: string;
  /** Was genau passiert, z. B. Name und Folgen */
  text?: string;
  /** Beschriftung der Aktion, z. B. „Löschen“ */
  ja: string;
  /** Löschen, Entfernen, Trennen: Aktion in der Fehlerfarbe */
  gefahr?: boolean;
};

type Anfrage = RueckfrageOptionen & { antwort: (ja: boolean) => void };

const EREIGNIS = "uniwars-rueckfrage";
let hatGastgeber = false;

/**
 * Ersatz für `window.confirm`: fragt im Design der App nach und liefert true bei „Ja“.
 * Ohne eingebundenes `<Rueckfrage />` (etwa außerhalb des Dashboards) fällt sie auf den Browser-Dialog zurück.
 */
export function rueckfrage(o: RueckfrageOptionen): Promise<boolean> {
  if (!hatGastgeber) return Promise.resolve(window.confirm(o.text ? `${o.titel}\n\n${o.text}` : o.titel));
  return new Promise((antwort) => window.dispatchEvent(new CustomEvent<Anfrage>(EREIGNIS, { detail: { ...o, antwort } })));
}

/**
 * Die eine Rückfrage für alles, was in den Papierkorb der Dateiablage geht (lässt sich dort wiederherstellen).
 * `was` ist der Satzanfang, z. B. „„Hausarbeit““ oder „Der Stapel „Statistik“ mit 12 Karten“.
 */
export function inDenPapierkorb(was: string): Promise<boolean> {
  return rueckfrage({
    titel: "In den Papierkorb legen?",
    text: `${was} kommt in den Papierkorb der Dateiablage. Dort kannst du es wiederherstellen.`,
    ja: "In den Papierkorb",
    gefahr: true,
  });
}

/**
 * Der Dialog dazu, einmal im Gerüst eingebunden. Fokus startet auf „Abbrechen“, damit Enter nichts löscht;
 * Escape und Klick daneben brechen ab; danach geht der Fokus dorthin zurück, wo er vorher war.
 */
export function Rueckfrage() {
  const [anfrage, setAnfrage] = useState<Anfrage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const abbrechen = useRef<HTMLButtonElement>(null);
  const zurueck = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    hatGastgeber = true;
    const auf = (e: Event) => {
      const neu = (e as CustomEvent<Anfrage>).detail;
      zurueck.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAnfrage((alt) => {
        alt?.antwort(false);
        return neu;
      });
    };
    window.addEventListener(EREIGNIS, auf);
    return () => {
      hatGastgeber = false;
      window.removeEventListener(EREIGNIS, auf);
    };
  }, []);

  useEffect(() => {
    if (!anfrage || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    abbrechen.current?.focus();
  }, [anfrage]);

  function fertig(ja: boolean) {
    const a = anfrage;
    dialog.current?.close();
    setAnfrage(null);
    const ziel = zurueck.current;
    if (ziel?.isConnected) ziel.focus();
    a?.antwort(ja);
  }

  if (!anfrage) return null;
  return (
    <dialog
      ref={dialog}
      className="formular-dialog rueckfrage"
      role="alertdialog"
      aria-labelledby={`${id}-titel`}
      aria-describedby={anfrage.text ? `${id}-text` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        fertig(false);
      }}
      onClick={(e) => {
        // Klick auf den Hintergrund: Ziel ist der Dialog selbst, aber außerhalb seiner Fläche
        const r = dialog.current?.getBoundingClientRect();
        if (e.target === dialog.current && r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) fertig(false);
      }}
    >
      <h2 id={`${id}-titel`} className="rueckfrage-titel">
        {anfrage.titel}
      </h2>
      {anfrage.text && (
        <p id={`${id}-text`} className="rueckfrage-text">
          {anfrage.text}
        </p>
      )}
      <div className="rueckfrage-knoepfe">
        <button ref={abbrechen} type="button" className="knopf leise" onClick={() => fertig(false)}>
          Abbrechen
        </button>
        <button type="button" className={`knopf ${anfrage.gefahr ? "gefahr" : "haupt"}`} onClick={() => fertig(true)}>
          {anfrage.ja}
        </button>
      </div>
    </dialog>
  );
}
