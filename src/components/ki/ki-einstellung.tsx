"use client";

import { useEffect, useState } from "react";
import { kiEinwilligungWiderrufen } from "@/app/(hubs)/ki/einwilligung-actions";
import { KI_EINWILLIGUNG_EVENT, KiEinwilligungDialog, kiEinwilligungMelden, type EinwilligungsEreignis } from "@/components/ki/ki-einwilligung-dialog";
import { track } from "@/lib/analytics";

/** KI-D1: Schalter in der Seitenleiste – Einwilligung geben oder widerrufen. */
export function KiEinstellung({ startEingewilligt }: { startEingewilligt: boolean }) {
  const [an, setAn] = useState(startEingewilligt);
  const [dialog, setDialog] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    const geaendert = (e: Event) => {
      const { art, an: neu } = (e as CustomEvent<EinwilligungsEreignis>).detail;
      if (art === "text") setAn(neu);
    };
    window.addEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
    return () => window.removeEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
  }, []);

  async function umschalten() {
    if (!an) {
      setDialog(true);
      return;
    }
    setLaeuft(true);
    const ergebnis = await kiEinwilligungWiderrufen("text").catch(() => null);
    setLaeuft(false);
    if (ergebnis?.ok) {
      setAn(false);
      kiEinwilligungMelden("text", false);
      track("ki_einwilligung_widerrufen");
    } else {
      window.alert("Das hat nicht geklappt. Bitte versuch es noch einmal.");
    }
  }

  return (
    <>
      <button type="button" className="sidebar-theme-toggle" onClick={() => void umschalten()} disabled={laeuft}>
        <span>KI-Funktionen</span>
        <span style={{ color: "var(--accent-strong)" }}>{an ? "An" : "Aus"}</span>
      </button>
      {dialog && (
        <KiEinwilligungDialog
          art="text"
          onSchliessen={() => setDialog(false)}
          onZugestimmt={() => {
            setAn(true);
            setDialog(false);
            track("ki_einwilligung_erteilt", { ort: "einstellungen" });
          }}
        />
      )}
    </>
  );
}
