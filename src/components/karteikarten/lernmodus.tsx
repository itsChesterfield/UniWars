"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { karteBeantworten, lernrundeAbschliessen } from "@/app/(hubs)/karteikarten/actions";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import { VorlesenKnopf } from "@/components/ki/vorlesen-knopf";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { studioMelden } from "@/lib/ki/studio-kontext";
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

/** Im Uhrzeigersinn ab oben: Einfach, Gut, Schwer, Nochmal (Bewegungskonzept „Ablage wird Ring“). */
const RING_FOLGE = [4, 3, 2, 1] as const;
const STUFEN = [...BEWERTUNGEN].sort((a, b) => RING_FOLGE.indexOf(a.wert) - RING_FOLGE.indexOf(b.wert));

/**
 * Vier Fächer neben der Karte: jede bewertete Karte legt sich als Linie auf ihr Fach,
 * so wächst die Auswertung während der Runde mit. Die Linien sind Schmuck, es zählt die Zahl.
 */
function Ablage({ zaehler }: { zaehler: Zaehler }) {
  return (
    <aside className="kk-ablage" aria-labelledby="kk-ablage-titel">
      <h2 className="kk-ablage-titel" id="kk-ablage-titel">
        Ablage dieser Runde
      </h2>
      <ul className="kk-faecher">
        {BEWERTUNGEN.map((b) => (
          <li key={b.wert} className={`kk-fach ${b.klasse}`}>
            <span className="kk-fach-linien" aria-hidden>
              {Array.from({ length: zaehler[b.wert] }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <span className="kk-fach-fuss">
              <span className="kk-fach-name">{b.name}</span>
              <span className="zahl">{zaehler[b.wert]}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Ergebnis der Runde als Ring. Die Zahlen stehen daneben als Text, der Ring selbst ist Schmuck. */
function Ergebnisring({ zaehler, karten }: { zaehler: Zaehler; karten: number }) {
  const gesamt = summe(zaehler);
  const anteile = STUFEN.map((b) => ({ ...b, laenge: (zaehler[b.wert] / gesamt) * 100 }));
  // Jeder Bogen beginnt dort, wo die Bögen vor ihm enden.
  const boegen = anteile.map((b, i) => ({ ...b, anfang: anteile.slice(0, i).reduce((s, x) => s + x.laenge, 0) }));
  return (
    <div className="kk-ergebnis">
      <div className="kk-ring" aria-hidden>
        <svg viewBox="-60 -60 120 120">
          <circle className="kk-ring-bahn" r="50" />
          {boegen.map((b) => (
            <circle
              key={b.wert}
              className={`kk-ring-bogen ${b.klasse}`}
              r="50"
              pathLength={100}
              strokeDasharray={`${Math.max(0, b.laenge - 1)} 100`}
              strokeDashoffset={-b.anfang}
              transform="rotate(-90)"
            />
          ))}
        </svg>
        <span className="kk-ring-zahl">
          <span className="zahl">{karten}</span>
          <small>{karten === 1 ? "Karte" : "Karten"}</small>
        </span>
      </div>
      <ul className="kk-auswertung" aria-label="Bewertungen">
        {STUFEN.map((b) => (
          <li key={b.wert} className={b.klasse}>
            <i aria-hidden />
            <span>{b.name}</span>
            <span className="zahl">{zaehler[b.wert]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  /** KI-14 Vorlesen ("Erklär mir das" läuft jetzt per Strg+J über UniVerse Studio) */
  kiVerfuegbar?: boolean;
}) {
  const [runde, setRunde] = useState<Runde | null>(() => (faellige.length > 0 ? neueRunde(faellige) : null));
  const [speicherFehler, setSpeicherFehler] = useState(false);
  // UniVerse Studio kennt die gezeigte Karte (Strg+J → "Erklär mir das")
  const gezeigt = runde ? runde.karten[runde.index] : null;
  useEffect(() => {
    studioMelden({ karte: gezeigt ? { stapelId: stapel.id, vorderseite: gezeigt.vorderseite, rueckseite: gezeigt.rueckseite } : null });
  }, [gezeigt, stapel.id]);
  useEffect(() => () => studioMelden({ karte: null }), []);
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
        if (e.target instanceof HTMLButtonElement) return; // der Knopf selbst löst schon aus
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
    <Link href={`/karteikarten/${stapel.id}`} className="knopf leise klein zurueck-link">
      <Icon name="pfeil-links" groesse={16} />
      {stapel.name}
    </Link>
  );

  if (!runde) {
    return (
      <>
        {zurueck}
        <Zustand
          art="leer"
          icon="haken"
          titel="Heute ist nichts fällig."
          ebene={1}
          aktion={
            karten.length > 0 && (
              <button type="button" className="knopf neben klein" onClick={alleLernen}>
                Trotzdem alle lernen
              </button>
            )
          }
        >
          Alle Karten in „{stapel.name}“ sind wiederholt. Morgen geht es weiter.
        </Zustand>
      </>
    );
  }

  if (runde.fertig) {
    const beantwortet = summe(runde.zaehler);
    const karten = new Set(runde.karten.slice(0, runde.index).map((k) => k.id)).size;
    return (
      <>
        {zurueck}
        <section className="kk-ende">
          <h1>Runde beendet.</h1>
          <p>
            <span className="zahl">{karten}</span> {karten === 1 ? "Karte" : "Karten"} in <span className="zahl">{beantwortet}</span> Antworten.
            {karten >= STREAK_MIN_KARTEN && " Zählt für deinen Streak."}
          </p>
          {beantwortet > 0 && <Ergebnisring zaehler={runde.zaehler} karten={karten} />}
          {speicherFehler && (
            <p className="formular-fehler" role="alert">
              Einige Antworten konnten nicht gespeichert werden.
            </p>
          )}
          <div className="kk-ende-knoepfe">
            <button type="button" className="knopf haupt" onClick={alleLernen}>
              Nochmal alle lernen
            </button>
            <Link href={`/karteikarten/${stapel.id}`} className="knopf leise">
              Zurück zum Stapel
            </Link>
          </div>
        </section>
      </>
    );
  }

  const karte = runde.karten[runde.index];

  return (
    <div className="kk-lernen">
      <div className="kk-lernen-kopf">
        {zurueck}
        <span className="zahl">
          {runde.index + 1} / {runde.karten.length}
        </span>
        <button type="button" className="knopf leise klein" onClick={() => beenden(runde)}>
          Beenden
        </button>
      </div>
      <span
        className="balkenf kk-fortschritt"
        role="progressbar"
        aria-label="Fortschritt der Runde"
        aria-valuemin={0}
        aria-valuemax={runde.karten.length}
        aria-valuenow={runde.index}
      >
        <i style={{ width: `${(runde.index / runde.karten.length) * 100}%` }} />
      </span>

      <div className="kk-buehne">
        <div className="kk-spielfeld">
          {/* Klick auf die Karte dreht sie um; per Tastatur über den Knopf darunter oder die Leertaste */}
          <div className={`kk-lernkarte ${runde.umgedreht ? "umgedreht" : ""}`} onClick={umdrehen}>
            <div className="kk-lernkarte-innen">
              <div className="kk-seite kk-vorne" aria-hidden={runde.umgedreht}>
                <span className="kk-seite-label">Vorderseite</span>
                <MarkdownAnzeige key={`v-${karte.id}`} wert={karte.vorderseite} label="Vorderseite" />
              </div>
              <div className="kk-seite kk-hinten" aria-hidden={!runde.umgedreht}>
                <span className="kk-seite-label">Rückseite</span>
                <MarkdownAnzeige key={`r-${karte.id}`} wert={karte.rueckseite} label="Rückseite" />
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

          {runde.umgedreht && (
            <p className="kk-tipp">
              Nicht verstanden? <kbd>Strg</kbd> + <kbd>J</kbd>, dann erklärt dir UniVerse Studio diese Karte.
            </p>
          )}

          {runde.umgedreht ? (
            <div className="kk-antworten" role="group" aria-label="Wie gut wusstest du es?">
              {BEWERTUNGEN.map((b) => (
                <button key={b.wert} type="button" className={`kk-antwort ${b.klasse}`} onClick={() => antworten(b.wert)}>
                  <span className="kk-antwort-name">{b.name}</span>
                  <span className="kk-antwort-zeit">{intervallText(vorschau(karte, b.wert))}</span>
                  <kbd>{b.wert}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="knopf haupt kk-aufdecken" onClick={umdrehen} autoFocus>
              Antwort zeigen
              <kbd>Leertaste</kbd>
            </button>
          )}
        </div>

        <Ablage zaehler={runde.zaehler} />
      </div>
    </div>
  );
}
