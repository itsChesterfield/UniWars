"use client";

import { useEffect, useRef, useState } from "react";
import { kiEinwilligungWiderrufen } from "@/app/(hubs)/notizen/ki-actions";
import { KI_EINWILLIGUNG_EVENT, KiEinwilligungInhalt, kiEinwilligungMelden } from "@/components/ki/ki-einwilligung";
import { track } from "@/lib/analytics";

/** KI-D1: Schalter in der Seitenleiste – Einwilligung geben oder widerrufen. */
export function KiEinstellung({ startEingewilligt }: { startEingewilligt: boolean }) {
  const [an, setAn] = useState(startEingewilligt);
  const [dialog, setDialog] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (dialog) ref.current?.showModal();
  }, [dialog]);

  useEffect(() => {
    const geaendert = (e: Event) => setAn((e as CustomEvent<boolean>).detail);
    window.addEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
    return () => window.removeEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
  }, []);

  async function umschalten() {
    if (!an) {
      setDialog(true);
      return;
    }
    setLaeuft(true);
    const ergebnis = await kiEinwilligungWiderrufen().catch(() => null);
    setLaeuft(false);
    if (ergebnis?.ok) {
      setAn(false);
      kiEinwilligungMelden(false);
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
        <dialog
          ref={ref}
          className="card ki-dialog ki-dialog-klein"
          onCancel={(e) => {
            e.preventDefault();
            setDialog(false);
          }}
        >
          <KiEinwilligungInhalt
            onAbbrechen={() => setDialog(false)}
            onZugestimmt={() => {
              setAn(true);
              setDialog(false);
              track("ki_einwilligung_erteilt", { ort: "einstellungen" });
            }}
          />
        </dialog>
      )}
    </>
  );
}
