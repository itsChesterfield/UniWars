"use client";

import { useEffect, useState } from "react";
import { kiEinwilligungWiderrufen, type EinwilligungsArt } from "@/app/(hubs)/ki/einwilligung-actions";
import { KI_EINWILLIGUNG_EVENT, KiEinwilligungDialog, kiEinwilligungMelden, type EinwilligungsEreignis } from "@/components/ki/ki-einwilligung-dialog";
import { track } from "@/lib/analytics";

const BESCHRIFTUNG: Record<EinwilligungsArt, string> = { text: "KI-Funktionen", audio: "Sprachfunktionen" };

/** KI-D1 / KI-D2: Schalter in der Seitenleiste – Einwilligung geben oder widerrufen (getrennt). */
export function KiEinstellung({ startEingewilligt, art = "text" }: { startEingewilligt: boolean; art?: EinwilligungsArt }) {
  const [an, setAn] = useState(startEingewilligt);
  const [dialog, setDialog] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    const geaendert = (e: Event) => {
      const detail = (e as CustomEvent<EinwilligungsEreignis>).detail;
      if (detail.art === art) setAn(detail.an);
    };
    window.addEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
    return () => window.removeEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
  }, [art]);

  async function umschalten() {
    if (!an) {
      setDialog(true);
      return;
    }
    setLaeuft(true);
    const ergebnis = await kiEinwilligungWiderrufen(art).catch(() => null);
    setLaeuft(false);
    if (ergebnis?.ok) {
      setAn(false);
      kiEinwilligungMelden(art, false);
      track("ki_einwilligung_widerrufen", { art });
    } else {
      window.alert("Das hat nicht geklappt. Bitte versuch es noch einmal.");
    }
  }

  return (
    <>
      <button type="button" className="sidebar-theme-toggle" onClick={() => void umschalten()} disabled={laeuft}>
        <span>{BESCHRIFTUNG[art]}</span>
        <span style={{ color: "var(--accent-strong)" }}>{an ? "An" : "Aus"}</span>
      </button>
      {dialog && (
        <KiEinwilligungDialog
          art={art}
          onSchliessen={() => setDialog(false)}
          onZugestimmt={() => {
            setAn(true);
            setDialog(false);
            track("ki_einwilligung_erteilt", { ort: "einstellungen", art });
          }}
        />
      )}
    </>
  );
}
