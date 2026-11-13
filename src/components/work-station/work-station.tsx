"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { einstellungenSpeichern } from "@/app/(hubs)/work-station/actions";
import { HubKopf } from "@/components/hubs/hub-bausteine";
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
  type TimerZustand,
  type WsEinstellungen,
} from "@/lib/work-station/timer";
import { SITZUNG_GESPEICHERT_EVENT, timerSchreiben, useJetzt, useTimerZustand } from "@/lib/work-station/timer-store";
import { benachrichtigungErfragen } from "@/lib/work-station/ton";
import type { FachVorschlag } from "@/lib/work-station/kontext";
import type { FachOption } from "@/lib/fach-option";
import { track } from "@/lib/analytics";

export type TagesEintrag = { fachId: string | null; name: string; farbe: string | null; minuten: number };

const RADIUS = 108;
const UMFANG = 2 * Math.PI * RADIUS;

export function WorkStation({
  einstellungen,
  faecher,
  vorschlag,
  heute,
}: {
  einstellungen: WsEinstellungen;
  faecher: FachOption[];
  vorschlag: FachVorschlag | null;
  heute: TagesEintrag[];
}) {
  const router = useRouter();
  const gespeichert = useTimerZustand();
  // Solange nichts gestartet wurde, gilt der Vorschlag aus Stundenplan/Deadlines (WS-02).
  const zustand: TimerZustand = gespeichert ?? startZustand(einstellungen, vorschlag?.fachId ?? null);
  const jetzt = useJetzt(zustand.laeuft);
  const rest = restzeit(zustand, jetzt);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);

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
    void sitzungMelden(sitzung, zustand.fachId);
    track("work_station_zurueckgesetzt", { modus: zustand.modus });
  }

  function ueberspringenKlick() {
    const { zustand: neu, sitzung } = ueberspringen(zustand, Date.now());
    timerSchreiben(neu);
    void sitzungMelden(sitzung, zustand.fachId);
    track("work_station_uebersprungen", { modus: zustand.modus });
  }

  function fachWaehlen(fachId: string) {
    timerSchreiben({ ...zustand, fachId: fachId || null });
  }

  const anteil = zustand.dauerMs > 0 ? rest / zustand.dauerMs : 0;
  const runde = (zustand.erledigteRunden % zustand.einstellungen.runden) + (zustand.modus === "fokus" ? 1 : 0);
  const gesamtHeute = heute.reduce((s, e) => s + e.minuten, 0);
  const maxMinuten = Math.max(1, ...heute.map((e) => e.minuten));
  const unberuehrt = !zustand.laeuft && rest === zustand.dauerMs;

  return (
    <>
      <HubKopf
        titel="Work Station"
        untertitel="Konzentriert lernen – jede Fokus-Runde zählt für deine Lernzeit."
        aktionen={
          <button type="button" className="btng" onClick={() => setEinstellungenOffen((o) => !o)} aria-expanded={einstellungenOffen}>
            ⚙ Einstellungen
          </button>
        }
      />

      {einstellungenOffen && (
        <EinstellungenFormular
          einstellungen={zustand.einstellungen}
          onGespeichert={(e) => {
            timerSchreiben(einstellungenAnwenden(zustand, e));
            setEinstellungenOffen(false);
          }}
        />
      )}

      <div className="ws-raster">
        <section className="card ws-timer-karte" data-modus={zustand.modus}>
          <label className="ws-fach">
            <span>Woran lernst du?</span>
            <select className="field" value={zustand.fachId ?? ""} onChange={(e) => fachWaehlen(e.target.value)}>
              <option value="">Allgemein</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {vorschlag && !gespeichert && <p className="ws-vorschlag muted">💡 {vorschlag.grund}</p>}

          <div className="ws-kreis">
            <svg viewBox="0 0 240 240" aria-hidden>
              <circle className="ws-kreis-spur" cx="120" cy="120" r={RADIUS} />
              <circle
                className="ws-kreis-fortschritt"
                cx="120"
                cy="120"
                r={RADIUS}
                strokeDasharray={UMFANG}
                strokeDashoffset={UMFANG * (1 - anteil)}
              />
            </svg>
            <div className="ws-kreis-text">
              <span className="ws-modus">{MODUS_NAME[zustand.modus]}</span>
              <span className="ws-zeit mono" role="timer" aria-live="off">
                {alsUhr(rest)}
              </span>
              <span className="ws-runde muted">
                {zustand.modus === "fokus" ? `Runde ${runde} von ${zustand.einstellungen.runden}` : "Durchatmen"}
              </span>
            </div>
          </div>

          <div className="ws-knoepfe">
            <button type="button" className="btnp ws-haupt" onClick={startPause}>
              {zustand.laeuft ? "Pause" : unberuehrt ? "Start" : "Weiter"}
            </button>
            <button type="button" className="btng" onClick={zuruecksetzenKlick} disabled={unberuehrt}>
              Zurücksetzen
            </button>
            <button type="button" className="btng" onClick={ueberspringenKlick}>
              Überspringen
            </button>
          </div>
          <p className="faint ws-hinweis">Der Timer läuft weiter, wenn du in einen anderen Hub wechselst.</p>
        </section>

        <section className="card ws-heute">
          <h2 className="ct">
            Heute: <span className="mono">{dauerText(gesamtHeute)}</span>
          </h2>
          {heute.length === 0 ? (
            <p className="empty-state">Noch keine Lernzeit heute. Starte deine erste Fokus-Runde!</p>
          ) : (
            <ul className="ws-balken">
              {heute.map((e) => (
                <li key={e.fachId ?? "allgemein"}>
                  <div className="rowb">
                    <span className="row" style={{ gap: 8 }}>
                      <span className="dot" style={{ background: e.farbe ?? "#94a3b8" }} />
                      {e.name}
                    </span>
                    <span className="mono muted">{dauerText(e.minuten)}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(e.minuten / maxMinuten) * 100}%`, background: e.farbe ?? undefined }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const FELDER: { schluessel: keyof typeof WS_GRENZEN; label: string; einheit: string }[] = [
  { schluessel: "fokus", label: "Fokusdauer", einheit: "Min" },
  { schluessel: "kurzePause", label: "Kurze Pause", einheit: "Min" },
  { schluessel: "langePause", label: "Lange Pause", einheit: "Min" },
  { schluessel: "runden", label: "Runden bis zur langen Pause", einheit: "" },
];

/** WS-04 */
function EinstellungenFormular({
  einstellungen,
  onGespeichert,
}: {
  einstellungen: WsEinstellungen;
  onGespeichert: (e: WsEinstellungen) => void;
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
    <form className="card ws-einstellungen" onSubmit={speichern}>
      <div className="ws-einstellungen-felder">
        {FELDER.map((f) => {
          const [min, max] = WS_GRENZEN[f.schluessel];
          return (
            <label key={f.schluessel}>
              <span>{f.label}</span>
              <span className="row" style={{ gap: 6 }}>
                <input
                  type="number"
                  className="field"
                  min={min}
                  max={max}
                  required
                  value={werte[f.schluessel]}
                  onChange={(e) => setWerte({ ...werte, [f.schluessel]: Number(e.target.value) })}
                />
                {f.einheit && <span className="muted">{f.einheit}</span>}
              </span>
              <span className="faint ws-grenze">
                {min}–{max}
              </span>
            </label>
          );
        })}
        <label className="ws-ton">
          <input type="checkbox" checked={werte.ton} onChange={(e) => setWerte({ ...werte, ton: e.target.checked })} />
          <span>Ton am Ende</span>
        </label>
      </div>
      {fehler && <p className="auth-error">{fehler}</p>}
      <div className="hub-formular-knoepfe">
        <button type="submit" className="btnp" disabled={laeuft}>
          {laeuft ? "…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
