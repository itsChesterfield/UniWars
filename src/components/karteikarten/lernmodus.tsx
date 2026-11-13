"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { karteBeantworten, lernrundeAbschliessen } from "@/app/(hubs)/karteikarten/actions";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import { STREAK_MIN_KARTEN, type Antwort } from "@/lib/karteikarten/leitner";
import { fehlerMelden, track } from "@/lib/analytics";

type LernKarte = { id: string; vorderseite: string; rueckseite: string; box: number; naechste_abfrage: string };

// Niedrige Boxen (schwierige Karten) zuerst, innerhalb einer Box gemischt.
function reihenfolge(karten: LernKarte[]) {
  return karten
    .map((k) => ({ k, zufall: Math.random() }))
    .sort((a, b) => a.k.box - b.k.box || a.zufall - b.zufall)
    .map(({ k }) => k);
}

type Runde = { karten: LernKarte[]; index: number; umgedreht: boolean; gewusst: number; nichtGewusst: number; fertig: boolean };

function neueRunde(karten: LernKarte[]): Runde {
  return { karten: reihenfolge(karten), index: 0, umgedreht: false, gewusst: 0, nichtGewusst: 0, fertig: false };
}

export function Lernmodus({
  stapel,
  karten,
  faellige,
}: {
  stapel: { id: string; name: string };
  karten: LernKarte[];
  /** KK-04: abgefragt werden nur fällige Karten. */
  faellige: LernKarte[];
}) {
  const [runde, setRunde] = useState<Runde | null>(() => (faellige.length > 0 ? neueRunde(faellige) : null));
  const [speicherFehler, setSpeicherFehler] = useState(false);

  useEffect(() => {
    if (faellige.length > 0) track("kk_lernen_gestartet", { karten: faellige.length, alle: false });
  }, [faellige.length]);

  const beenden = useCallback(
    (r: Runde) => {
      const beantwortet = r.gewusst + r.nichtGewusst;
      setRunde({ ...r, fertig: true });
      if (beantwortet > 0) {
        track("kk_lernrunde_beendet", { gewusst: r.gewusst, nicht_gewusst: r.nichtGewusst, vollstaendig: r.index >= r.karten.length });
        lernrundeAbschliessen(stapel.id, beantwortet).catch((err) => fehlerMelden(err, { ort: "kk_lernrunde" }));
      }
    },
    [stapel.id],
  );

  const umdrehen = useCallback(() => {
    setRunde((r) => (r && !r.fertig ? { ...r, umgedreht: !r.umgedreht } : r));
  }, []);

  const antworten = useCallback(
    (antwort: Antwort) => {
      if (!runde || runde.fertig || !runde.umgedreht) return;
      const karte = runde.karten[runde.index];
      karteBeantworten(karte.id, antwort).catch((err) => {
        setSpeicherFehler(true);
        fehlerMelden(err, { ort: "kk_beantworten" });
      });
      const naechste: Runde = {
        ...runde,
        index: runde.index + 1,
        umgedreht: false,
        gewusst: runde.gewusst + (antwort === "gewusst" ? 1 : 0),
        nichtGewusst: runde.nichtGewusst + (antwort === "nicht_gewusst" ? 1 : 0),
      };
      if (naechste.index >= naechste.karten.length) beenden(naechste);
      else setRunde(naechste);
    },
    [runde, beenden],
  );

  // Leertaste = umdrehen, 1 = nicht gewusst, 2 = gewusst
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === " ") {
        e.preventDefault();
        umdrehen();
      } else if (e.key === "1") antworten("nicht_gewusst");
      else if (e.key === "2") antworten("gewusst");
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [umdrehen, antworten]);

  function alleLernen() {
    setRunde(neueRunde(karten));
    track("kk_lernen_gestartet", { karten: karten.length, alle: true });
  }

  const zurueck = (
    <Link href={`/karteikarten/${stapel.id}`} className="hub-zurueck-link">
      ← {stapel.name}
    </Link>
  );

  if (!runde) {
    return (
      <>
        {zurueck}
        <div className="card kk-lernen-leer">
          <div className="hub-leer-icon" aria-hidden>
            ✅
          </div>
          <h2 className="ct">Heute nichts fällig</h2>
          <p className="muted">Alle Karten in „{stapel.name}“ sind wiederholt. Morgen geht&apos;s weiter.</p>
          {karten.length > 0 && (
            <button type="button" className="btnp" onClick={alleLernen}>
              Trotzdem alle lernen
            </button>
          )}
        </div>
      </>
    );
  }

  if (runde.fertig) {
    const beantwortet = runde.gewusst + runde.nichtGewusst;
    return (
      <>
        {zurueck}
        <div className="card kk-zusammenfassung">
          <div className="hub-leer-icon" aria-hidden>
            🎉
          </div>
          <h2 className="ct">Runde beendet</h2>
          <p className="kk-ergebnis">
            <strong>{runde.gewusst}</strong> gewusst, <strong>{runde.nichtGewusst}</strong> nicht gewusst
          </p>
          {beantwortet >= STREAK_MIN_KARTEN && <p className="muted">🔥 Zählt für deinen Streak.</p>}
          {speicherFehler && <p className="auth-error">Einige Antworten konnten nicht gespeichert werden.</p>}
          <div className="hub-formular-knoepfe">
            <Link href={`/karteikarten/${stapel.id}`} className="btng">
              Zurück zum Stapel
            </Link>
            <button type="button" className="btnp" onClick={alleLernen}>
              Nochmal alle lernen
            </button>
          </div>
        </div>
      </>
    );
  }

  const karte = runde.karten[runde.index];
  const fortschritt = (runde.index / runde.karten.length) * 100;

  return (
    <div className="kk-lernen">
      <div className="kk-lernen-kopf">
        {zurueck}
        <span className="mono kk-fortschritt-text">
          {runde.index + 1} / {runde.karten.length}
        </span>
        <button type="button" className="btng" onClick={() => beenden(runde)}>
          Beenden
        </button>
      </div>
      <div className="progress-track kk-fortschritt" aria-hidden>
        <div className="progress-fill" style={{ width: `${fortschritt}%` }} />
      </div>

      <div
        role="button"
        tabIndex={0}
        className={`kk-lernkarte ${runde.umgedreht ? "umgedreht" : ""}`}
        onClick={umdrehen}
        onKeyDown={(e) => {
          if (e.key === "Enter") umdrehen();
        }}
        aria-label={runde.umgedreht ? "Karte umdrehen (Vorderseite zeigen)" : "Karte umdrehen (Rückseite zeigen)"}
      >
        <div className="kk-lernkarte-innen">
          <div className="kk-seite kk-vorne" aria-hidden={runde.umgedreht}>
            <span className="kk-seite-label">Vorderseite</span>
            <MarkdownAnzeige key={`v-${karte.id}`} wert={karte.vorderseite} />
          </div>
          <div className="kk-seite kk-hinten" aria-hidden={!runde.umgedreht}>
            <span className="kk-seite-label">Rückseite</span>
            <MarkdownAnzeige key={`r-${karte.id}`} wert={karte.rueckseite} />
          </div>
        </div>
      </div>

      {runde.umgedreht ? (
        <div className="kk-antworten">
          <button type="button" className="kk-antwort nein" onClick={() => antworten("nicht_gewusst")}>
            Nicht gewusst <kbd>1</kbd>
          </button>
          <button type="button" className="kk-antwort ja" onClick={() => antworten("gewusst")}>
            Gewusst <kbd>2</kbd>
          </button>
        </div>
      ) : (
        <p className="muted kk-tipp">
          Klicke auf die Karte oder drück <kbd>Leertaste</kbd> zum Umdrehen.
        </p>
      )}
    </div>
  );
}
