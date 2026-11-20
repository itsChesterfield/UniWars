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

export type EingabeOptionen = Omit<RueckfrageOptionen, "gefahr"> & {
  /** Beschriftung des Felds, z. B. „Name“ */
  label: string;
  /** Vorbelegung */
  wert?: string;
  /** Leeres Feld darf bestätigt werden (z. B. „leer lassen zum Löschen“) */
  leerErlaubt?: boolean;
};

/** Antwort: null heißt abgebrochen; bei einer Rückfrage ohne Feld steht für „Ja“ ein leerer Text */
type Anfrage = RueckfrageOptionen & { feld?: Omit<EingabeOptionen, keyof RueckfrageOptionen>; antwort: (wert: string | null) => void };

const EREIGNIS = "uniwars-rueckfrage";
let hatGastgeber = false;

function fragen(detail: Omit<Anfrage, "antwort">): Promise<string | null> {
  return new Promise((antwort) => window.dispatchEvent(new CustomEvent<Anfrage>(EREIGNIS, { detail: { ...detail, antwort } })));
}

/**
 * Ersatz für `window.confirm`: fragt im Design der App nach und liefert true bei „Ja“.
 * Ohne eingebundenes `<Rueckfrage />` (etwa außerhalb des Dashboards) fällt sie auf den Browser-Dialog zurück.
 */
export async function rueckfrage(o: RueckfrageOptionen): Promise<boolean> {
  if (!hatGastgeber) return window.confirm(o.text ? `${o.titel}\n\n${o.text}` : o.titel);
  return (await fragen(o)) !== null;
}

/**
 * Ersatz für `window.prompt`: ein Feld im selben Dialog. Liefert den Text ohne Leerraum an den Rändern,
 * oder null bei „Abbrechen“.
 */
export async function eingabe(o: EingabeOptionen): Promise<string | null> {
  if (!hatGastgeber) return window.prompt(o.text ? `${o.titel}\n\n${o.text}` : o.titel, o.wert ?? "")?.trim() ?? null;
  const { label, wert, leerErlaubt, ...rest } = o;
  const ergebnis = await fragen({ ...rest, feld: { label, wert, leerErlaubt } });
  return ergebnis === null ? null : ergebnis.trim();
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
 * Der Dialog dazu, einmal im Gerüst eingebunden. Ohne Feld startet der Fokus auf „Abbrechen“, damit Enter nichts löscht;
 * mit Feld im Feld (Enter bestätigt). Escape und Klick daneben brechen ab; danach geht der Fokus dorthin zurück, wo er vorher war.
 */
export function Rueckfrage() {
  const [anfrage, setAnfrage] = useState<Anfrage | null>(null);
  const [text, setText] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const abbrechen = useRef<HTMLButtonElement>(null);
  const feld = useRef<HTMLInputElement>(null);
  const zurueck = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    hatGastgeber = true;
    const auf = (e: Event) => {
      const neu = (e as CustomEvent<Anfrage>).detail;
      zurueck.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setText(neu.feld?.wert ?? "");
      setAnfrage((alt) => {
        alt?.antwort(null);
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
    if (anfrage.feld) feld.current?.select();
    else abbrechen.current?.focus();
  }, [anfrage]);

  function fertig(ergebnis: string | null) {
    const a = anfrage;
    dialog.current?.close();
    setAnfrage(null);
    const ziel = zurueck.current;
    if (ziel?.isConnected) ziel.focus();
    a?.antwort(ergebnis);
  }

  if (!anfrage) return null;
  const gesperrt = Boolean(anfrage.feld && !anfrage.feld.leerErlaubt && !text.trim());
  return (
    <dialog
      ref={dialog}
      className="formular-dialog rueckfrage"
      role={anfrage.feld ? undefined : "alertdialog"}
      aria-labelledby={`${id}-titel`}
      aria-describedby={anfrage.text ? `${id}-text` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        fertig(null);
      }}
      onClick={(e) => {
        // Klick auf den Hintergrund: Ziel ist der Dialog selbst, aber außerhalb seiner Fläche
        const r = dialog.current?.getBoundingClientRect();
        if (e.target === dialog.current && r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) fertig(null);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!gesperrt) fertig(anfrage.feld ? text : "");
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
        {anfrage.feld && (
          <label className="rueckfrage-feld">
            <span>{anfrage.feld.label}</span>
            <input ref={feld} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}
        <div className="rueckfrage-knoepfe">
          <button ref={abbrechen} type="button" className="knopf leise" onClick={() => fertig(null)}>
            Abbrechen
          </button>
          <button type="submit" className={`knopf ${anfrage.gefahr ? "gefahr" : "haupt"}`} disabled={gesperrt}>
            {anfrage.ja}
          </button>
        </div>
      </form>
    </dialog>
  );
}
