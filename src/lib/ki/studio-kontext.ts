"use client";

/**
 * UniVerse Studio: Was ist gerade offen? Seiten melden hier ihren Zustand (z. B. die
 * aktuelle PDF-Seite oder die gezeigte Karteikarte); das Studio liest ihn beim Senden.
 * Nur im Browser, nichts davon wird gespeichert.
 */
export type StudioZustand = {
  pdf?: { id: string; seite: number } | null;
  karte?: { stapelId: string; vorderseite: string; rueckseite: string } | null;
};

let zustand: StudioZustand = {};

export function studioMelden(teil: Partial<StudioZustand>) {
  zustand = { ...zustand, ...teil };
}

export function studioZustand(): StudioZustand {
  return zustand;
}

/** Ereignis: UniVerse Studio öffnen (z. B. aus der eingebetteten zweiten Ansicht oder per Hinweis) */
export const STUDIO_OEFFNEN = "uniwars-studio-oeffnen";
/** Ereignis an den Notiz-Editor: Text an der aktuellen Stelle einfügen (von der KI) */
export const NOTIZ_EINFUEGEN = "uniwars-notiz-einfuegen";

/** UniVerse Studio öffnen – optional gleich mit einer Frage */
export function studioOeffnen(frage?: string) {
  window.dispatchEvent(new CustomEvent(STUDIO_OEFFNEN, { detail: { frage: frage ?? null } }));
}

/** Gerade markierter Text (für "Erklär mir das") – höchstens 4.000 Zeichen */
export function markierterText(): string {
  if (typeof window === "undefined") return "";
  const sel = window.getSelection?.()?.toString() ?? "";
  return sel.replace(/\s+/g, " ").trim().slice(0, 4000);
}
