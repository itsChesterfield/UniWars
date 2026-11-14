"use client";

import { useState } from "react";
import { kontingenteLaden } from "@/app/(hubs)/ki/sprach-actions";
import type { KiKontingente } from "@/lib/ki/server";

const zahl = (n: number) => n.toLocaleString("de-DE");

/** Einstellungen: verbleibende KI-Kontingente (Text, Assistent, Audio, Vorlesen). Lädt erst beim Aufklappen. */
export function KiKontingentAnzeige() {
  const [daten, setDaten] = useState<KiKontingente | null>(null);
  const [fehler, setFehler] = useState(false);

  return (
    <details
      className="ki-kontingent"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return;
        setFehler(false);
        void kontingenteLaden()
          .catch(() => null)
          .then((a) => (a?.ok ? setDaten(a.daten) : setFehler(true)));
      }}
    >
      <summary>KI-Kontingent</summary>
      {fehler ? (
        <p className="muted">Konnte nicht geladen werden.</p>
      ) : !daten ? (
        <p className="muted">Lädt …</p>
      ) : (
        <ul>
          <li>
            Heute: {zahl(Math.max(0, daten.text.limit - daten.text.genutzt))} / {zahl(daten.text.limit)} KI-Anfragen
          </li>
          <li>
            Heute: {zahl(Math.max(0, daten.chat.limit - daten.chat.genutzt))} / {zahl(daten.chat.limit)} Assistent-Nachrichten
          </li>
          <li>
            Monat: {zahl(Math.max(0, Math.floor((daten.audioSekunden.limit - daten.audioSekunden.genutzt) / 60)))} / {zahl(daten.audioSekunden.limit / 60)} Audio-Minuten
          </li>
          <li>
            Monat: {zahl(Math.max(0, daten.ttsZeichen.limit - daten.ttsZeichen.genutzt))} / {zahl(daten.ttsZeichen.limit)} Vorlese-Zeichen
          </li>
        </ul>
      )}
    </details>
  );
}
