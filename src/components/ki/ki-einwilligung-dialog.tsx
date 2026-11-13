"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { kiEinwilligen, type EinwilligungsArt } from "@/app/(hubs)/ki/einwilligung-actions";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";

/** Gemeldet, wenn sich eine Einwilligung ändert – hält Seitenleiste und Dialoge synchron. */
export const KI_EINWILLIGUNG_EVENT = "uniwars:ki-einwilligung";
export type EinwilligungsEreignis = { art: EinwilligungsArt; an: boolean };

export function kiEinwilligungMelden(art: EinwilligungsArt, an: boolean) {
  window.dispatchEvent(new CustomEvent<EinwilligungsEreignis>(KI_EINWILLIGUNG_EVENT, { detail: { art, an } }));
}

const TEXTE: Record<EinwilligungsArt, { titel: string; absatz: React.ReactNode; widerruf: string }> = {
  text: {
    titel: "KI-Funktionen nutzen?",
    absatz: (
      <>
        Für diese Funktion wird der Inhalt deiner Notiz an <strong>Mistral AI (Frankreich, EU)</strong> gesendet und dort
        verarbeitet. Es werden nur die Inhalte gesendet, die du für die KI-Funktion auswählst.
      </>
    ),
    widerruf: "KI-Funktionen",
  },
  audio: {
    titel: "Sprachfunktionen nutzen?",
    absatz: (
      <>
        Deine Sprachaufnahme wird an <strong>Mistral AI (EU)</strong> gesendet und in Text umgewandelt. Die Aufnahme selbst
        wird nicht gespeichert, nur der erkannte Text.
      </>
    ),
    widerruf: "Sprachfunktionen",
  },
};

/** KI-D1 / KI-D2: Inhalt der Einwilligung (im eigenen Dialog oder eingebettet in einen KI-Dialog). */
export function KiEinwilligungInhalt({
  art = "text",
  onAbbrechen,
  onZugestimmt,
}: {
  art?: EinwilligungsArt;
  onAbbrechen: () => void;
  onZugestimmt: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const t = TEXTE[art];

  async function zustimmen() {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await kiEinwilligen(art).catch(() => null);
    if (ergebnis?.ok) {
      kiEinwilligungMelden(art, true);
      onZugestimmt();
      return;
    }
    setFehler(ergebnis && !ergebnis.ok ? ergebnis.fehler : "Das hat nicht geklappt. Bitte versuch es noch einmal.");
    setLaeuft(false);
  }

  return (
    <div className="ki-einwilligung">
      <h3 className="ct">{t.titel}</h3>
      <p>{t.absatz}</p>
      <p className="muted">
        Du kannst die Einwilligung jederzeit in der Seitenleiste unter „{t.widerruf}“ widerrufen. Mehr dazu in der{" "}
        <Link href="/datenschutz#ki" target="_blank">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <KiFehlerMeldung meldung={fehler} />
      <div className="hub-formular-knoepfe">
        <button type="button" className="btng" onClick={onAbbrechen} disabled={laeuft}>
          Abbrechen
        </button>
        <button type="button" className="btnp" onClick={() => void zustimmen()} disabled={laeuft}>
          {laeuft ? "Speichert …" : "Einverstanden"}
        </button>
      </div>
    </div>
  );
}

/** Eigenständiger Einwilligungsdialog (z. B. aus der Seitenleiste oder vor der ersten Sprachfunktion). */
export function KiEinwilligungDialog({
  art = "text",
  onSchliessen,
  onZugestimmt,
}: {
  art?: EinwilligungsArt;
  onSchliessen: () => void;
  onZugestimmt: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="card ki-dialog ki-dialog-klein"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
    >
      <KiEinwilligungInhalt art={art} onAbbrechen={onSchliessen} onZugestimmt={onZugestimmt} />
    </dialog>
  );
}
