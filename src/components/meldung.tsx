"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/nav-icon";

/** fehler: etwas hat nicht geklappt; hinweis: eine Regel oder ein Ergebnis, das man sonst nicht sieht */
export type MeldungArt = "fehler" | "hinweis";

type Eintrag = { nr: number; text: string; art: MeldungArt; erneut?: () => unknown };

const EREIGNIS = "uniwars-meldung";
let hatGastgeber = false;
let zaehler = 0;

/** So lange bleibt eine Meldung stehen; beim Darüberfahren, mit dem Fokus darin oder während „Erneut versuchen“ läuft, wartet sie */
const DAUER: Record<MeldungArt, number> = { hinweis: 4000, fehler: 10000 };

/**
 * Ersatz für `window.alert`: kurze Meldung unten in der Mitte, im Design der App.
 * Nicht für Erfolge, die man ohnehin sieht (DESIGN.md Abschnitt 9). Ohne eingebundenes `<Meldung />` fällt sie auf den Browser zurück.
 * Mit `erneut` trägt ein Fehler den Knopf „Erneut versuchen“: der Knopf zeigt das Laden; schlägt es wieder fehl,
 * meldet die Aktion selbst den neuen Fehler, sonst verschwindet die Meldung.
 */
export function meldung(text: string, art: MeldungArt = "fehler", erneut?: () => unknown) {
  if (!hatGastgeber) {
    window.alert(text);
    return;
  }
  window.dispatchEvent(new CustomEvent<Eintrag>(EREIGNIS, { detail: { nr: ++zaehler, text, art, erneut } }));
}

/** Die Fläche dazu, einmal im Gerüst eingebunden. Zeigt immer nur die neueste Meldung. */
export function Meldung() {
  const [eintrag, setEintrag] = useState<Eintrag | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const aktuell = useRef(0);
  const flaeche = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hatGastgeber = true;
    const auf = (e: Event) => {
      const neu = (e as CustomEvent<Eintrag>).detail;
      aktuell.current = neu.nr;
      setLaeuft(false);
      setEintrag(neu);
    };
    window.addEventListener(EREIGNIS, auf);
    return () => {
      hatGastgeber = false;
      window.removeEventListener(EREIGNIS, auf);
    };
  }, []);

  useEffect(() => {
    if (!eintrag || laeuft) return;
    // Erst beim Ablaufen nachsehen, ob Maus oder Fokus darauf sind; dann noch etwas warten
    let t = 0;
    const ablaufen = () => {
      const el = flaeche.current;
      if (el && (el.matches(":hover") || el.contains(document.activeElement))) t = window.setTimeout(ablaufen, 1000);
      else setEintrag(null);
    };
    t = window.setTimeout(ablaufen, DAUER[eintrag.art]);
    return () => window.clearTimeout(t);
  }, [eintrag, laeuft]);

  function schliessen() {
    setEintrag(null);
    setLaeuft(false);
  }

  async function nochmal(e: Eintrag) {
    if (!e.erneut) return;
    setLaeuft(true);
    try {
      await e.erneut();
    } finally {
      // Hat die Aktion inzwischen eine neue Meldung gezeigt, bleibt die stehen
      if (aktuell.current === e.nr) schliessen();
    }
  }

  return (
    <>
      {/* Die beiden Live-Regionen stehen immer im Dokument, damit Screenreader neue Meldungen sicher ansagen */}
      <div className="vh" role="alert">
        {eintrag?.art === "fehler" ? eintrag.text : ""}
      </div>
      <div className="vh" role="status">
        {eintrag?.art === "hinweis" ? eintrag.text : ""}
      </div>
      {eintrag && (
        <div
          ref={flaeche}
          key={eintrag.nr}
          className={`meldung meldung-${eintrag.art}`}
        >
          {eintrag.art === "fehler" && <Icon name="warnung" groesse={16} />}
          <p aria-hidden="true">{eintrag.text}</p>
          {eintrag.erneut && (
            <button type="button" className="knopf neben klein" disabled={laeuft} aria-busy={laeuft} onClick={() => void nochmal(eintrag)}>
              Erneut versuchen
            </button>
          )}
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Meldung schließen" onClick={schliessen}>
            <Icon name="schliessen" groesse={16} />
          </button>
        </div>
      )}
    </>
  );
}
