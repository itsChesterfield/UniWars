"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFokusraum } from "@/lib/fokusraum-store";
import { arbeitszeitLaden, einstellungenSpeichern, type Arbeitszeit } from "@/app/(hubs)/work-station/actions";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { sitzungMelden } from "@/components/work-station/timer-waechter";
import {
  MODUS_NAME,
  WS_GRENZEN,
  alsUhr,
  dauerText,
  einstellungenAnwenden,
  pausieren,
  restzeit,
  startZustand,
  starten,
  ueberspringen,
  zuruecksetzen,
  minutenAusWinkel,
  stellBereich,
  type AufgabeTyp,
  type FokusAufgabe,
  type TimerZustand,
  type WsEinstellungen,
} from "@/lib/work-station/timer";
import { SITZUNG_GESPEICHERT_EVENT, timerLesen, timerSchreiben, useJetzt, useTimerZustand } from "@/lib/work-station/timer-store";
import { benachrichtigungErfragen } from "@/lib/work-station/ton";
import type { FachVorschlag } from "@/lib/work-station/kontext";
import type { FachOption } from "@/lib/fach-option";
import { track } from "@/lib/analytics";

export type TagesEintrag = { fachId: string | null; name: string; farbe: string | null; minuten: number };

/** Offene Aufgabe zur Auswahl: Abgabe/Frist, Gruppenarbeit, To-do oder Prüfungsvorbereitung */
export type AufgabeOption = { typ: AufgabeTyp; id: string; titel: string; fachId: string | null; gruppe: string; wann: string | null };

const GRUPPEN_REIHE = ["Abgaben und Fristen", "Gruppenarbeiten", "To-dos", "Prüfungsvorbereitung"];

/** Bisherige Arbeitszeit an der gewählten Aufgabe, bei Gruppenarbeit je Person */
function BisherGearbeitet({ aufgabe }: { aufgabe: FokusAufgabe }) {
  const [liste, setListe] = useState<{ fuer: string; zeiten: Arbeitszeit[] } | null>(null);
  const schluessel = `${aufgabe.typ}:${aufgabe.id}`;
  useEffect(() => {
    let aktuell = true;
    const laden = () =>
      arbeitszeitLaden({ typ: aufgabe.typ, id: aufgabe.id })
        .then((zeiten) => aktuell && setListe({ fuer: schluessel, zeiten }))
        .catch(() => undefined);
    void laden();
    window.addEventListener(SITZUNG_GESPEICHERT_EVENT, laden);
    return () => {
      aktuell = false;
      window.removeEventListener(SITZUNG_GESPEICHERT_EVENT, laden);
    };
  }, [aufgabe.typ, aufgabe.id, schluessel]);
  // Solange noch geladen wird (oder das Laden scheitert), nichts behaupten
  if (liste?.fuer !== schluessel) return null;
  const zeiten = liste.zeiten;
  const gesamt = zeiten.reduce((n, z) => n + z.minuten, 0);
  if (!gesamt) return <p className="ws-bisher">Noch keine Fokuszeit für diese Aufgabe.</p>;
  return (
    <p className="ws-bisher">
      Bisher <b className="zahl">{dauerText(gesamt)}</b>
      {zeiten.length > 1 && (
        <span className="ws-bisher-personen">
          {zeiten.map((z) => (
            <span key={z.userId}>
              {z.name} <span className="zahl">{dauerText(z.minuten)}</span>
            </span>
          ))}
        </span>
      )}
    </p>
  );
}

const RADIUS = 108;
const UMFANG = 2 * Math.PI * RADIUS;

export function WorkStation({
  einstellungen,
  faecher,
  vorschlag,
  heute,
  heuteFehler = false,
  aufgaben = [],
  startAufgabe = null,
}: {
  einstellungen: WsEinstellungen;
  faecher: FachOption[];
  vorschlag: FachVorschlag | null;
  heute: TagesEintrag[];
  /** Lernzeit von heute ließ sich nicht laden; der Timer läuft trotzdem */
  heuteFehler?: boolean;
  aufgaben?: AufgabeOption[];
  /** Aus dem Aufgaben-Detail „Fokus starten“: diese Aufgabe vorauswählen */
  startAufgabe?: AufgabeOption | null;
}) {
  const router = useRouter();
  const gespeichert = useTimerZustand();
  // Solange nichts gestartet wurde, gilt der Vorschlag aus Stundenplan/Deadlines (WS-02).
  const zustand: TimerZustand = gespeichert ?? startZustand(einstellungen, vorschlag?.fachId ?? null);
  const jetzt = useJetzt(zustand.laeuft);
  const rest = restzeit(zustand, jetzt);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const kreisRef = useRef<HTMLDivElement>(null);
  const ziehen = useRef(false);
  const speicherTimer = useRef<number | null>(null);
  const raumWahl = useFokusraum();

  // „Fokus starten“ aus dem Aufgaben-Detail: Aufgabe übernehmen, mit den eigenen Einstellungen
  useEffect(() => {
    if (!startAufgabe) return;
    const basis = timerLesen() ?? startZustand(einstellungen, startAufgabe.fachId ?? vorschlag?.fachId ?? null);
    timerSchreiben({
      ...basis,
      aufgabe: { typ: startAufgabe.typ, id: startAufgabe.id, titel: startAufgabe.titel },
      fachId: startAufgabe.fachId ?? basis.fachId,
    });
    router.replace("/work-station", { scroll: false });
  }, [startAufgabe, einstellungen, vorschlag, router]);

  // Nach jeder gespeicherten Sitzung die Tagesübersicht neu laden.
  useEffect(() => {
    const neuLaden = () => router.refresh();
    window.addEventListener(SITZUNG_GESPEICHERT_EVENT, neuLaden);
    return () => window.removeEventListener(SITZUNG_GESPEICHERT_EVENT, neuLaden);
  }, [router]);

  function startPause() {
    if (zustand.laeuft) {
      timerSchreiben(pausieren(zustand, Date.now()));
      track("work_station_pausiert", { modus: zustand.modus });
    } else {
      benachrichtigungErfragen();
      timerSchreiben(starten(zustand, Date.now()));
      track("work_station_gestartet", { modus: zustand.modus, mit_fach: Boolean(zustand.fachId), fokus_minuten: zustand.einstellungen.fokus });
    }
  }

  function zuruecksetzenKlick() {
    const { zustand: neu, sitzung } = zuruecksetzen(zustand, Date.now());
    timerSchreiben(neu);
    void sitzungMelden(sitzung, zustand.fachId, zustand.modus === "fokus" ? (zustand.aufgabe ?? null) : null);
    track("work_station_zurueckgesetzt", { modus: zustand.modus });
  }

  function ueberspringenKlick() {
    const { zustand: neu, sitzung } = ueberspringen(zustand, Date.now());
    timerSchreiben(neu);
    void sitzungMelden(sitzung, zustand.fachId, zustand.modus === "fokus" ? (zustand.aufgabe ?? null) : null);
    track("work_station_uebersprungen", { modus: zustand.modus });
  }

  function fachWaehlen(fachId: string) {
    timerSchreiben({ ...zustand, fachId: fachId || null });
  }

  function aufgabeWaehlen(wert: string) {
    const a = aufgaben.find((x) => `${x.typ}:${x.id}` === wert);
    // Fach der Aufgabe übernehmen, damit die Lernzeit beim richtigen Fach landet
    timerSchreiben({ ...zustand, aufgabe: a ? { typ: a.typ, id: a.id, titel: a.titel } : null, fachId: a?.fachId ?? zustand.fachId });
    track("fokus_aufgabe_gewaehlt", { typ: a?.typ ?? "keine" });
  }

  // Dauer direkt am Kreis einstellen (nur solange die Phase noch nicht begonnen hat)
  const stellbar = !zustand.laeuft && zustand.restMs === zustand.dauerMs;
  const bereich = stellBereich(zustand.modus);
  const stellMinuten = zustand.einstellungen[bereich.feld];
  const kreisAnteil = stellbar ? stellMinuten / bereich.max : zustand.dauerMs > 0 ? rest / zustand.dauerMs : 0;
  const griffWinkel = kreisAnteil * 2 * Math.PI;
  const griffX = 120 + RADIUS * Math.sin(griffWinkel);
  const griffY = 120 - RADIUS * Math.cos(griffWinkel);

  function minutenSetzen(minuten: number) {
    const aktuell = timerLesen() ?? zustand;
    if (aktuell.einstellungen[bereich.feld] === minuten) return;
    timerSchreiben(einstellungenAnwenden(aktuell, { ...aktuell.einstellungen, [bereich.feld]: minuten }));
  }

  /** `klick`: erster Druck auf den Kreis, dann zählt genau die angeklickte Stelle */
  function ausZeiger(x: number, y: number, klick = false) {
    const r = kreisRef.current?.getBoundingClientRect();
    if (!r) return;
    const winkel = (Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180) / Math.PI;
    const vorher = klick ? null : (timerLesen() ?? zustand).einstellungen[bereich.feld];
    minutenSetzen(minutenAusWinkel(winkel, bereich, vorher));
  }

  function zugEnde() {
    if (!ziehen.current) return;
    ziehen.current = false;
    speichernSpaeter();
  }

  /** Neue Dauer als Standard merken, kurz nachdem sie feststeht */
  function speichernSpaeter() {
    if (speicherTimer.current) window.clearTimeout(speicherTimer.current);
    speicherTimer.current = window.setTimeout(() => {
      const e = (timerLesen() ?? zustand).einstellungen;
      void einstellungenSpeichern(e).catch(() => undefined);
      track("work_station_dauer_gezogen", { feld: bereich.feld, minuten: e[bereich.feld] });
    }, 600);
  }

  const gruppen = GRUPPEN_REIHE.map((g) => ({ name: g, liste: aufgaben.filter((a) => a.gruppe === g) })).filter((g) => g.liste.length);
  const gewaehlt = zustand.aufgabe && aufgaben.some((a) => a.typ === zustand.aufgabe?.typ && a.id === zustand.aufgabe?.id) ? zustand.aufgabe : null;

  const runde = (zustand.erledigteRunden % zustand.einstellungen.runden) + (zustand.modus === "fokus" ? 1 : 0);
  const gesamtHeute = heute.reduce((s, e) => s + e.minuten, 0);
  const maxMinuten = Math.max(1, ...heute.map((e) => e.minuten));
  const unberuehrt = !zustand.laeuft && rest === zustand.dauerMs;

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Work Station</h1>
          <p>Konzentriert lernen. Jede Fokus-Runde zählt für deine Lernzeit.</p>
        </div>
        <div className="rechts">
          <Link href="/work-station/raum" className="knopf neben">
            {raumWahl ? `Fokusraum: ${raumWahl.titel}` : "Fokusraum"}
          </Link>
          <button type="button" className="knopf leise" onClick={() => setEinstellungenOffen((o) => !o)} aria-expanded={einstellungenOffen}>
            <Icon name="einstellungen" groesse={16} />
            Einstellungen
          </button>
        </div>
      </header>

      {einstellungenOffen && (
        <EinstellungenFormular
          einstellungen={zustand.einstellungen}
          onAbbrechen={() => setEinstellungenOffen(false)}
          onGespeichert={(e) => {
            timerSchreiben(einstellungenAnwenden(zustand, e));
            setEinstellungenOffen(false);
          }}
        />
      )}

      <div className="ws-raster">
        <section className="ws-timer-karte" data-modus={zustand.modus} aria-label="Fokus-Timer">
          <label className="ws-fach">
            <span>Woran arbeitest du?</span>
            <select value={gewaehlt ? `${gewaehlt.typ}:${gewaehlt.id}` : ""} onChange={(e) => aufgabeWaehlen(e.target.value)}>
              <option value="">Keine bestimmte Aufgabe</option>
              {gruppen.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.liste.map((a) => (
                    <option key={`${a.typ}:${a.id}`} value={`${a.typ}:${a.id}`}>
                      {a.wann ? `${a.titel} (${a.wann})` : a.titel}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {gewaehlt && <BisherGearbeitet aufgabe={gewaehlt} />}
          <label className="ws-fach">
            <span>Fach</span>
            <select value={zustand.fachId ?? ""} onChange={(e) => fachWaehlen(e.target.value)}>
              <option value="">Allgemein</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {vorschlag && !gespeichert && (
            <p className="ws-vorschlag">
              <Icon name="tipp" groesse={16} />
              {vorschlag.grund}
            </p>
          )}

          <div
            ref={kreisRef}
            className={`ws-kreis${stellbar ? " stellbar" : ""}`}
            onPointerDown={(e) => {
              if (!stellbar) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              ziehen.current = true;
              // Druck auf den Griff selbst ändert nichts, erst das Ziehen
              if (e.target !== e.currentTarget.querySelector(".ws-griff")) ausZeiger(e.clientX, e.clientY, true);
            }}
            onPointerMove={(e) => ziehen.current && ausZeiger(e.clientX, e.clientY)}
            onPointerUp={zugEnde}
            // Touch abgebrochen (z. B. Systemgeste): Ziehen sauber beenden
            onPointerCancel={zugEnde}
            onLostPointerCapture={zugEnde}
          >
            <svg viewBox="0 0 240 240" aria-hidden>
              <circle className="ws-kreis-spur" cx="120" cy="120" r={RADIUS} />
              <circle
                className="ws-kreis-fortschritt"
                cx="120"
                cy="120"
                r={RADIUS}
                strokeDasharray={UMFANG}
                strokeDashoffset={UMFANG * (1 - kreisAnteil)}
              />
            </svg>
            {stellbar && (
              <span
                className="ws-griff"
                role="slider"
                tabIndex={0}
                aria-label={`Dauer ${MODUS_NAME[zustand.modus]}`}
                aria-valuemin={bereich.min}
                aria-valuemax={bereich.max}
                aria-valuenow={stellMinuten}
                aria-valuetext={`${stellMinuten} Minuten`}
                style={{ left: `${(griffX / 240) * 100}%`, top: `${(griffY / 240) * 100}%` }}
                onKeyDown={(e) => {
                  const schritte: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 3, PageDown: -3 };
                  let neu: number | null = null;
                  if (e.key in schritte) neu = stellMinuten + schritte[e.key] * bereich.schritt;
                  else if (e.key === "Home") neu = bereich.min;
                  else if (e.key === "End") neu = bereich.max;
                  if (neu === null) return;
                  e.preventDefault();
                  minutenSetzen(Math.min(bereich.max, Math.max(bereich.min, neu)));
                  speichernSpaeter();
                }}
              />
            )}
            <div className="ws-kreis-text">
              <span className="ws-modus">{MODUS_NAME[zustand.modus]}</span>
              <span className="ws-zeit zahl" role="timer" aria-live="off">
                {alsUhr(rest)}
              </span>
              <span className="ws-runde">
                {zustand.modus === "fokus" ? `Runde ${runde} von ${zustand.einstellungen.runden}` : "Durchatmen"}
              </span>
            </div>
          </div>

          <div className="ws-knoepfe">
            <button type="button" className="knopf haupt ws-haupt" onClick={startPause}>
              <Icon name={zustand.laeuft ? "pause" : "abspielen"} groesse={16} />
              {zustand.laeuft ? "Pause" : unberuehrt ? "Start" : "Weiter"}
            </button>
            <button type="button" className="knopf leise" onClick={zuruecksetzenKlick} disabled={unberuehrt}>
              <Icon name="rueckgaengig" groesse={16} />
              Zurücksetzen
            </button>
            <button type="button" className="knopf leise" onClick={ueberspringenKlick}>
              <Icon name="vor" groesse={16} />
              Überspringen
            </button>
          </div>
          <p className="ws-hinweis">
            {stellbar ? "Zieh den Punkt am Kreis, um die Dauer einzustellen. " : ""}Der Timer läuft weiter, wenn du in einen anderen Bereich wechselst.
          </p>
        </section>

        <section className="ws-heute" aria-labelledby="ws-heute-titel">
          <div className="abschnitt-kopf">
            <h2 id="ws-heute-titel" className="abschnitt-titel">
              Heute gelernt
            </h2>
            {!heuteFehler && <span className="abschnitt-info zahl">{dauerText(gesamtHeute)}</span>}
          </div>
          {heuteFehler ? (
            <Zustand
              art="fehler"
              titel="Deine Lernzeit lässt sich gerade nicht laden."
              region
              ebene={3}
              aktion={
                <button type="button" className="knopf leise klein" onClick={() => router.refresh()}>
                  Erneut versuchen
                </button>
              }
            >
              Der Timer läuft trotzdem. Jede Fokus-Runde wird gespeichert.
            </Zustand>
          ) : heute.length === 0 ? (
            <Zustand art="leer" icon="fokus" titel="Noch keine Lernzeit heute." region ebene={3}>
              Starte eine Fokus-Runde. Sie zählt hier für das gewählte Fach.
            </Zustand>
          ) : (
            <ul className="entry-list">
              {heute.map((e) => {
                const farbe = { "--c": e.farbe ?? "var(--text-3)" } as CSSProperties;
                return (
                  <li key={e.fachId ?? "allgemein"} className="entry-row fach-zeile">
                    <span className="fach-farbe" style={farbe} aria-hidden />
                    <div className="entry-info">
                      <span className="entry-title">{e.name}</span>
                      <span className="balkenf" style={farbe} aria-hidden>
                        <i style={{ width: `${(e.minuten / maxMinuten) * 100}%` }} />
                      </span>
                    </div>
                    <span className="fortschritt-wert zahl">{dauerText(e.minuten)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const FELDER: { schluessel: keyof typeof WS_GRENZEN; label: string; einheit: string }[] = [
  { schluessel: "fokus", label: "Fokus", einheit: "Minuten" },
  { schluessel: "kurzePause", label: "Kurze Pause", einheit: "Minuten" },
  { schluessel: "langePause", label: "Lange Pause", einheit: "Minuten" },
  { schluessel: "runden", label: "Runden bis zur langen Pause", einheit: "" },
];

/** WS-04 */
function EinstellungenFormular({
  einstellungen,
  onGespeichert,
  onAbbrechen,
}: {
  einstellungen: WsEinstellungen;
  onGespeichert: (e: WsEinstellungen) => void;
  onAbbrechen: () => void;
}) {
  const [werte, setWerte] = useState(einstellungen);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      const gespeichert = await einstellungenSpeichern(werte);
      track("work_station_einstellungen", { ...gespeichert });
      onGespeichert(gespeichert);
    } catch {
      setFehler("Speichern hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="crud-form" onSubmit={speichern} aria-labelledby="ws-einst-titel">
      <h3 id="ws-einst-titel">Einstellungen</h3>
      <div className="crud-form-reihe">
        {FELDER.map((f) => {
          const [min, max] = WS_GRENZEN[f.schluessel];
          return (
            <div key={f.schluessel}>
              <label htmlFor={`ws-${f.schluessel}`}>{f.label}</label>
              <input
                id={`ws-${f.schluessel}`}
                type="number"
                min={min}
                max={max}
                required
                aria-describedby={`ws-${f.schluessel}-grenze`}
                value={werte[f.schluessel]}
                onChange={(e) => setWerte({ ...werte, [f.schluessel]: Number(e.target.value) })}
              />
              <span id={`ws-${f.schluessel}-grenze`} className="qz-hinweis">
                {min} bis {max} {f.einheit}
              </span>
            </div>
          );
        })}
      </div>
      <label className="ws-ton">
        <input type="checkbox" checked={werte.ton} onChange={(e) => setWerte({ ...werte, ton: e.target.checked })} />
        Ton am Ende
      </label>
      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}
      <div className="crud-form-actions">
        <button type="submit" className="knopf haupt" aria-busy={laeuft} disabled={laeuft}>
          Speichern
        </button>
        <button type="button" className="knopf leise" onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
