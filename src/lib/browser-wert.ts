"use client";

import { useSyncExternalStore } from "react";

// Kleine Einstellungen pro Gerät (z. B. Seitenleiste eingeklappt, PDF-Ansicht),
// die Neuladen überstehen. Ohne Speicher (privater Modus) gelten sie bis zum Neuladen.
const listeners = new Map<string, Set<() => void>>();
const ersatz = new Map<string, string | null>();

function lesen(schluessel: string): string | null {
  try {
    return window.localStorage.getItem(schluessel);
  } catch {
    return ersatz.get(schluessel) ?? null;
  }
}

export function browserWertSchreiben(schluessel: string, wert: string | null) {
  try {
    if (wert === null) window.localStorage.removeItem(schluessel);
    else window.localStorage.setItem(schluessel, wert);
  } catch {
    ersatz.set(schluessel, wert);
  }
  listeners.get(schluessel)?.forEach((l) => l());
}

/** Liest einen Wert aus dem Browser-Speicher; beim Server-Rendern gilt `standard`. */
export function useBrowserWert(schluessel: string, standard: string): string {
  return useSyncExternalStore(
    (listener) => {
      const set = listeners.get(schluessel) ?? new Set();
      set.add(listener);
      listeners.set(schluessel, set);
      const beiStorage = (e: StorageEvent) => {
        if (e.key === schluessel) listener();
      };
      window.addEventListener("storage", beiStorage);
      return () => {
        set.delete(listener);
        window.removeEventListener("storage", beiStorage);
      };
    },
    () => lesen(schluessel) ?? standard,
    () => standard,
  );
}
