"use client";

import { befehleOeffnen } from "@/components/befehlspalette";

/** Suchfeld im Dashboard: öffnet die Befehlspalette (Strg/⌘+O) – eine Suche für alles */
export function SearchBar() {
  return (
    <button type="button" className="search-bar search-bar-knopf" onClick={() => befehleOeffnen()} aria-label="Suchen, öffnen, erstellen (Strg+O)">
      <span className="search-bar-icon" aria-hidden>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </span>
      <span className="search-bar-platzhalter">Suchen, öffnen, erstellen …</span>
      <span className="kbd">Strg O</span>
    </button>
  );
}
