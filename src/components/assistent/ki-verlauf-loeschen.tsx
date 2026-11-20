"use client";

import { useState } from "react";
import { alleUnterhaltungenLoeschen } from "@/app/(hubs)/assistent/actions";
import { track } from "@/lib/analytics";
import { rueckfrage } from "@/components/rueckfrage";
import { meldung } from "@/components/meldung";

/** Einstellungen (Seitenleiste): „Alle KI-Unterhaltungen löschen“ (8.5). */
export function KiVerlaufLoeschen() {
  const [laeuft, setLaeuft] = useState(false);
  async function loeschen() {
    if (!(await rueckfrage({ titel: "Alle Unterhaltungen löschen?", text: "Alle Unterhaltungen mit UniVerse Studio werden gelöscht. Das lässt sich nicht rückgängig machen.", ja: "Alle löschen", gefahr: true }))) return;
    setLaeuft(true);
    const a = await alleUnterhaltungenLoeschen().catch(() => null);
    setLaeuft(false);
    if (!a?.ok) return meldung("Löschen hat nicht geklappt.");
    track("ki_unterhaltungen_alle_geloescht", { anzahl: a.daten.anzahl });
    meldung(a.daten.anzahl ? `${a.daten.anzahl} Unterhaltung${a.daten.anzahl === 1 ? "" : "en"} gelöscht.` : "Es gab keine Unterhaltungen.", "hinweis");
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
