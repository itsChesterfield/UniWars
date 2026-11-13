"use client";

import { useState } from "react";
import Link from "next/link";
import { kiEinwilligen } from "@/app/(hubs)/notizen/ki-actions";

/** Gemeldet, wenn sich die Einwilligung ändert – hält Seitenleiste und Dialoge synchron. */
export const KI_EINWILLIGUNG_EVENT = "uniwars:ki-einwilligung";

export function kiEinwilligungMelden(an: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(KI_EINWILLIGUNG_EVENT, { detail: an }));
}

/** KI-D1: Einwilligung vor der ersten KI-Anfrage (im Dialog und in der Seitenleiste). */
export function KiEinwilligungInhalt({ onAbbrechen, onZugestimmt }: { onAbbrechen: () => void; onZugestimmt: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function zustimmen() {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await kiEinwilligen().catch(() => null);
    if (ergebnis?.ok) {
      kiEinwilligungMelden(true);
      onZugestimmt();
      return;
    }
    setFehler(ergebnis && !ergebnis.ok ? ergebnis.fehler : "Das hat nicht geklappt. Bitte versuch es noch einmal.");
    setLaeuft(false);
  }

  return (
    <div className="ki-einwilligung">
      <h3 className="ct">KI-Funktionen nutzen?</h3>
      <p>
        Für diese Funktion wird der Inhalt deiner Notiz an <strong>Mistral AI (Frankreich, EU)</strong> gesendet und dort
        verarbeitet. Es werden nur die Inhalte gesendet, die du für die KI-Funktion auswählst.
      </p>
      <p className="muted">
        Du kannst die Einwilligung jederzeit in der Seitenleiste unter „KI-Funktionen“ widerrufen. Mehr dazu in der{" "}
        <Link href="/datenschutz" target="_blank">
          Datenschutzerklärung
        </Link>
        .
      </p>
      {fehler && <p className="auth-error">{fehler}</p>}
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
