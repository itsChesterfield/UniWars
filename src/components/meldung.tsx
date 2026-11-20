"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/nav-icon";

/** fehler: etwas hat nicht geklappt; hinweis: eine Regel oder ein Ergebnis, das man sonst nicht sieht */
export type MeldungArt = "fehler" | "hinweis";

type Eintrag = { nr: number; text: string; art: MeldungArt };

const EREIGNIS = "uniwars-meldung";
let hatGastgeber = false;
let zaehler = 0;

/** So lange bleibt eine Meldung stehen; beim Darüberfahren oder mit dem Fokus darin wartet sie */
const DAUER: Record<MeldungArt, number> = { hinweis: 4000, fehler: 10000 };

/**
 * Ersatz für `window.alert`: kurze Meldung unten in der Mitte, im Design der App.
 * Nicht für Erfolge, die man ohnehin sieht (DESIGN.md Abschnitt 9). Ohne eingebundenes `<Meldung />` fällt sie auf den Browser zurück.
 */
export function meldung(text: string, art: MeldungArt = "fehler") {
  if (!hatGastgeber) {
    window.alert(text);
    return;
  }
  window.dispatchEvent(new CustomEvent<Eintrag>(EREIGNIS, { detail: { nr: ++zaehler, text, art } }));
}

/** Die Fläche dazu, einmal im Gerüst eingebunden. Zeigt immer nur die neueste Meldung. */
export function Meldung() {
  const [eintrag, setEintrag] = useState<Eintrag | null>(null);
  const [wartet, setWartet] = useState(false);

  useEffect(() => {
    hatGastgeber = true;
    const auf = (e: Event) => setEintrag((e as CustomEvent<Eintrag>).detail);
    window.addEventListener(EREIGNIS, auf);
    return () => {
      hatGastgeber = false;
      window.removeEventListener(EREIGNIS, auf);
    };
  }, []);

  useEffect(() => {
    if (!eintrag || wartet) return;
    const t = window.setTimeout(() => setEintrag(null), DAUER[eintrag.art]);
    return () => window.clearTimeout(t);
  }, [eintrag, wartet]);

  function schliessen() {
    setEintrag(null);
    setWartet(false);
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
          key={eintrag.nr}
          className={`meldung meldung-${eintrag.art}`}
          onMouseEnter={() => setWartet(true)}
          onMouseLeave={() => setWartet(false)}
          onFocus={() => setWartet(true)}
          onBlur={() => setWartet(false)}
        >
          {eintrag.art === "fehler" && <Icon name="warnung" groesse={16} />}
          <p aria-hidden="true">{eintrag.text}</p>
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Meldung schließen" onClick={schliessen}>
            <Icon name="schliessen" groesse={16} />
          </button>
        </div>
      )}
    </>
  );
}
