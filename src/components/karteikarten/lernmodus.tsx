"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { karteBeantworten, lernrundeAbschliessen } from "@/app/(hubs)/karteikarten/actions";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import { VorlesenKnopf } from "@/components/ki/vorlesen-knopf";
import { KiErklaerung } from "@/components/karteikarten/ki-erklaerung";
import {
  BEWERTUNGEN,
  bewerten,
  intervallText,
  STREAK_MIN_KARTEN,
  type Bewertung,
  type KartenStand,
} from "@/lib/karteikarten/wiederholung";
import { fehlerMelden, track } from "@/lib/analytics";
import { berlinTageZwischen } from "@/lib/zeit";

type LernKarte = KartenStand & {
  id: string;
  vorderseite: string;
  rueckseite: string;
  naechste_abfrage: string;
  zuletzt_gelernt: string | null;
};

/** Gleiche Rechnung wie auf dem Server – für die Vorschau auf den Knöpfen. */
function vorschau(karte: LernKarte, bewertung: Bewertung): number {
  const tageSeit = karte.zuletzt_gelernt ? berlinTageZwischen(new Date(karte.zuletzt_gelernt), new Date()) : null;
  return bewerten(karte, bewertung, tageSeit).intervall_tage;
}

// Kurze Intervalle (schwierige/neue Karten) zuerst, sonst gemischt.
function reihenfolge(karten: LernKarte[]) {
  return karten
    .map((k) => ({ k, zufall: Math.random() }))
    .sort((a, b) => Math.min(a.k.intervall_tage, 3) - Math.min(b.k.intervall_tage, 3) || a.zufall - b.zufall)
    .map(({ k }) => k);
}

/** "Nochmal"-Karten kommen nach so vielen anderen Karten in derselben Runde wieder. */
const NOCHMAL_ABSTAND = 3;

type Zaehler = Record<Bewertung, number>;
type Runde = { karten: LernKarte[]; index: number; umgedreht: boolean; zaehler: Zaehler; fertig: boolean };

const LEER: Zaehler = { 1: 0, 2: 0, 3: 0, 4: 0 };

function neueRunde(karten: LernKarte[]): Runde {
  return { karten: reihenfolge(karten), index: 0, umgedreht: false, zaehler: { ...LEER }, fertig: false };
}

const summe = (z: Zaehler) => z[1] + z[2] + z[3] + z[4];

export function Lernmodus({
  stapel,
  karten,
  faellige,
  kiVerfuegbar = false,
}: {
  stapel: { id: string; name: string };
  karten: LernKarte[];
  /** KK-04: abgefragt werden nur fällige Karten. */
  faellige: LernKarte[];
  /** KI-11 "Erklär mir das" */
  kiVerfuegbar?: boolean;
}) {
  const [runde, setRunde] = useState<Runde | null>(() => (faellige.length > 0 ? neueRunde(faellige) : null));
  const [speicherFehler, setSpeicherFehler] = useState(false);
  // Antworten pro Karte nacheinander speichern ("Nochmal" + spätere Antwort derselben Karte)
  const speicherKette = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    if (faellige.length > 0) track("kk_lernen_gestartet", { karten: faellige.length, alle: false });
  }, [faellige.length]);

  const beenden = useCallback(
    (r: Runde) => {
      const beantwortet = summe(r.zaehler);
      setRunde({ ...r, fertig: true });
      if (beantwortet > 0) {
        track("kk_lernrunde_beendet", {
          nochmal: r.zaehler[1],
          schwer: r.zaehler[2],
          gut: r.zaehler[3],
          einfach: r.zaehler[4],
          vollstaendig: r.index >= r.karten.length,
        });
        const karten = new Set(r.karten.slice(0, r.index).map((k) => k.id)).size;
        lernrundeAbschliessen(stapel.id, karten).catch((err) => fehlerMelden(err, { ort: "kk_lernrunde" }));
      }
    },
    [stapel.id],
  );

  const umdrehen = useCallback(() => {
    setRunde((r) => (r && !r.fertig ? { ...r, umgedreht: !r.umgedreht } : r));
  }, []);

  const antworten = useCallback(
    (bewertung: Bewertung) => {
      if (!runde || runde.fertig || !runde.umgedreht) return;
      const karte = runde.karten[runde.index];
      const kette = speicherKette.current;
      const speichern = (kette.get(karte.id) ?? Promise.resolve())
        .then(() => karteBeantworten(karte.id, bewertung))
        .catch((err) => {
          setSpeicherFehler(true);
          fehlerMelden(err, { ort: "kk_beantworten" });
        });
      kette.set(karte.id, speichern);

      let karten = runde.karten;
      if (bewertung === 1) {
        // Nicht gewusst: gleich nochmal üben – mit zurückgesetztem Stand
        const wieder = { ...karte, ...bewerten(karte, 1), zuletzt_gelernt: new Date().toISOString() };
        const ziel = Math.min(runde.index + 1 + NOCHMAL_ABSTAND, karten.length);
        karten = [...karten.slice(0, ziel), wieder, ...karten.slice(ziel)];
      }
      const naechste: Runde = {
        ...runde,
        karten,
        index: runde.index + 1,
        umgedreht: false,
        zaehler: { ...runde.zaehler, [bewertung]: runde.zaehler[bewertung] + 1 },
      };
      if (naechste.index >= naechste.karten.length) beenden(naechste);
      else setRunde(naechste);
      track("kk_bewertet", { bewertung });
    },
    [runde, beenden],
  );

  // Leertaste = umdrehen, 1–4 = Nochmal / Schwer / Gut / Einfach
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === " ") {
        e.preventDefault();
        umdrehen();
      } else if (["1", "2", "3", "4"].includes(e.key)) antworten(Number(e.key) as Bewertung);
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
    const beantwortet = summe(runde.zaehler);
    const karten = new Set(runde.karten.slice(0, runde.index).map((k) => k.id)).size;
    return (
      <>
        {zurueck}
        <div className="card kk-zusammenfassung">
          <div className="hub-leer-icon" aria-hidden>
            🎉
          </div>
          <h2 className="ct">Runde beendet</h2>
          <p className="kk-ergebnis">
            <strong>{karten}</strong> {karten === 1 ? "Karte" : "Karten"} in <strong>{beantwortet}</strong> Antworten
          </p>
          {beantwortet > 0 && (
            <ul className="kk-auswertung" aria-label="Bewertungen">
              {BEWERTUNGEN.map((b) => (
                <li key={b.wert} className={b.klasse}>
                  <span>{b.name}</span>
                  <span className="kk-auswertung-balken" aria-hidden>
                    <span style={{ width: `${(runde.zaehler[b.wert] / beantwortet) * 100}%` }} />
                  </span>
                  <strong className="mono">{runde.zaehler[b.wert]}</strong>
                </li>
              ))}
            </ul>
          )}
          {karten >= STREAK_MIN_KARTEN && <p className="muted">🔥 Zählt für deinen Streak.</p>}
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

      {kiVerfuegbar && (
        <div className="kk-vorlesen">
          {/* KI-14: Seite vorlesen (außerhalb der Karte, damit der Klick sie nicht umdreht) */}
          <VorlesenKnopf
            key={`${karte.id}-${runde.umgedreht ? "r" : "v"}`}
            text={runde.umgedreht ? karte.rueckseite : karte.vorderseite}
            cacheKey={`kk-${karte.id}-${runde.umgedreht ? "r" : "v"}`}
            label={runde.umgedreht ? "Rückseite vorlesen" : "Vorderseite vorlesen"}
          />
        </div>
      )}

      {runde.umgedreht && kiVerfuegbar && <KiErklaerung key={`${karte.id}-${runde.index}`} karteId={karte.id} />}

      {runde.umgedreht ? (
        <div className="kk-antworten kk-antworten-4" role="group" aria-label="Wie gut wusstest du es?">
          {BEWERTUNGEN.map((b) => (
            <button key={b.wert} type="button" className={`kk-antwort ${b.klasse}`} onClick={() => antworten(b.wert)}>
              <span className="kk-antwort-zeit">{intervallText(vorschau(karte, b.wert))}</span>
              <span className="kk-antwort-name">{b.name}</span>
              <kbd>{b.wert}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted kk-tipp">
          Klicke auf die Karte oder drück <kbd>Leertaste</kbd> zum Umdrehen.
        </p>
      )}
    </div>
  );
}
