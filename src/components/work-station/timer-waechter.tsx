"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abschliessen, istAbgelaufen, MODUS_NAME, type FokusAufgabe, type Sitzung } from "@/lib/work-station/timer";
import { SITZUNG_GESPEICHERT_EVENT, timerLesen, timerSchreiben, useTimerZustand } from "@/lib/work-station/timer-store";
import { benachrichtigen, signalton } from "@/lib/work-station/ton";
import { fokusAufgabeErledigt, sitzungSpeichern } from "@/app/(hubs)/work-station/actions";
import { fehlerMelden, track } from "@/lib/analytics";

export async function sitzungMelden(sitzung: Sitzung | null, fachId: string | null, aufgabe: FokusAufgabe | null = null) {
  if (!sitzung) return;
  try {
    await sitzungSpeichern({ startMs: sitzung.start, minuten: sitzung.minuten, fachId, aufgabe: aufgabe ? { typ: aufgabe.typ, id: aufgabe.id } : null });
    track("lernsitzung_gespeichert", { minuten: sitzung.minuten, abgeschlossen: sitzung.abgeschlossen, mit_fach: Boolean(fachId) });
    window.dispatchEvent(new Event(SITZUNG_GESPEICHERT_EVENT));
  } catch (err) {
    fehlerMelden(err, { ort: "work_station_sitzung" });
  }
}

/**
 * Läuft auf jeder Seite mit Sidebar: beendet abgelaufene Phasen, speichert die
 * Sitzung und meldet sich mit Ton und Browser-Benachrichtigung (WS-06).
 */
export function TimerWaechter() {
  useEffect(() => {
    const pruefen = () => {
      const z = timerLesen();
      if (!z || !istAbgelaufen(z, Date.now())) return;
      const { zustand, sitzung } = abschliessen(z);
      // Ein anderer Tab war schneller?
      if (timerLesen()?.endetUm !== z.endetUm) return;
      timerSchreiben(zustand);
      if (z.einstellungen.ton) signalton();
      benachrichtigen(
        z.modus === "fokus" ? "Fokus-Runde geschafft" : "Pause vorbei",
        z.modus === "fokus"
          ? zustand.frage
            ? `„${zustand.frage.titel}“ erledigt? Zeit für: ${MODUS_NAME[zustand.modus]}`
            : `Zeit für: ${MODUS_NAME[zustand.modus]}`
          : "Weiter geht's mit der nächsten Fokus-Runde.",
      );
      track("work_station_phase_beendet", { modus: z.modus });
      void sitzungMelden(sitzung, z.fachId, z.modus === "fokus" ? (z.aufgabe ?? null) : null);
    };
    pruefen();
    const id = window.setInterval(pruefen, 1000);
    return () => window.clearInterval(id);
  }, []);

  return <FokusFrage />;
}

/**
 * Nach einer Fokus-Runde mit Aufgabe: „Abgeschlossen?“ – Ja hakt die Aufgabe ab,
 * Nein behält sie für die nächste Runde, Überspringen schließt nur die Frage.
 */
export function FokusFrage() {
  const router = useRouter();
  const z = useTimerZustand();
  const [laeuft, starte] = useTransition();
  const frage = z?.frage ?? null;
  if (!z || !frage) return null;

  function antworten(antwort: "ja" | "nein" | "ueberspringen") {
    const aktuell = timerLesen();
    if (!aktuell || !frage) return;
    track("fokus_aufgabe_frage", { antwort, typ: frage.typ });
    if (antwort !== "ja") {
      timerSchreiben({ ...aktuell, frage: null });
      return;
    }
    starte(async () => {
      try {
        await fokusAufgabeErledigt({ typ: frage.typ, id: frage.id });
        timerSchreiben({ ...aktuell, frage: null, aufgabe: null });
        router.refresh();
      } catch (err) {
        fehlerMelden(err, { ort: "fokus_aufgabe_erledigt" });
      }
    });
  }

  return (
    <section className="fokus-frage" role="dialog" aria-labelledby="fokus-frage-titel">
      <h2 id="fokus-frage-titel">Fokus-Runde geschafft</h2>
      <p>
        Ist <b>{frage.titel}</b> abgeschlossen?
      </p>
      <div className="fokus-frage-knoepfe">
        <button type="button" className="knopf haupt klein" disabled={laeuft} onClick={() => antworten("ja")}>
          Ja, erledigt
        </button>
        <button type="button" className="knopf neben klein" disabled={laeuft} onClick={() => antworten("nein")}>
          Nein, weiter
        </button>
        <button type="button" className="knopf leise klein" disabled={laeuft} onClick={() => antworten("ueberspringen")}>
          Überspringen
        </button>
      </div>
    </section>
  );
}
