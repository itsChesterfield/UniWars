"use client";

import { useEffect } from "react";
import { abschliessen, istAbgelaufen, MODUS_NAME, type Sitzung } from "@/lib/work-station/timer";
import { SITZUNG_GESPEICHERT_EVENT, timerLesen, timerSchreiben } from "@/lib/work-station/timer-store";
import { benachrichtigen, signalton } from "@/lib/work-station/ton";
import { sitzungSpeichern } from "@/app/(hubs)/work-station/actions";
import { fehlerMelden, track } from "@/lib/analytics";

export async function sitzungMelden(sitzung: Sitzung | null, fachId: string | null) {
  if (!sitzung) return;
  try {
    await sitzungSpeichern({ startMs: sitzung.start, minuten: sitzung.minuten, fachId });
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
        z.modus === "fokus" ? "Fokus-Runde geschafft 🎉" : "Pause vorbei",
        z.modus === "fokus" ? `Zeit für: ${MODUS_NAME[zustand.modus]}` : "Weiter geht's mit der nächsten Fokus-Runde.",
      );
      track("work_station_phase_beendet", { modus: z.modus });
      void sitzungMelden(sitzung, z.fachId);
    };
    pruefen();
    const id = window.setInterval(pruefen, 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
