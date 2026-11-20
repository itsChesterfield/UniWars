"use client";

import { useState } from "react";
import { alleUnterhaltungenLoeschen } from "@/app/(hubs)/assistent/actions";
import { track } from "@/lib/analytics";

/** Einstellungen (Seitenleiste): „Alle KI-Unterhaltungen löschen“ (8.5). */
export function KiVerlaufLoeschen() {
  const [laeuft, setLaeuft] = useState(false);
  async function loeschen() {
    if (!window.confirm("Alle Unterhaltungen mit dem Assistenten löschen? Das lässt sich nicht rückgängig machen.")) return;
    setLaeuft(true);
    const a = await alleUnterhaltungenLoeschen().catch(() => null);
    setLaeuft(false);
    if (!a?.ok) return window.alert("Löschen hat nicht geklappt.");
    track("ki_unterhaltungen_alle_geloescht", { anzahl: a.daten.anzahl });
    window.alert(a.daten.anzahl ? `${a.daten.anzahl} Unterhaltung${a.daten.anzahl === 1 ? "" : "en"} gelöscht.` : "Es gab keine Unterhaltungen.");
  }
  return (
    <div className="einst-zeile">
      <span>
        KI-Verlauf
        <small>Alle Unterhaltungen mit Studio löschen.</small>
      </span>
      <button type="button" className="knopf gefahr klein" onClick={() => void loeschen()} disabled={laeuft} aria-busy={laeuft}>
        Löschen
      </button>
    </div>
  );
}
