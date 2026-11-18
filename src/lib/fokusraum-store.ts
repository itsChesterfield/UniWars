"use client";

import { useSyncExternalStore } from "react";

/** Beigetretener Fokusraum (pro Gerät). Freigaben: Name/Fach zeigen. */
export type FokusraumWahl = { topic: string; titel: string; nameZeigen: boolean; fachZeigen: boolean };

const SCHLUESSEL = "universe-fokusraum";
const EREIGNIS = "universe-fokusraum-geaendert";

function lesenRoh(): string | null {
  try {
    return window.localStorage.getItem(SCHLUESSEL);
  } catch {
    return null;
  }
}

let zuletzt: { roh: string | null; wert: FokusraumWahl | null } = { roh: null, wert: null };
export function fokusraumLesen(): FokusraumWahl | null {
  const roh = lesenRoh();
  if (roh !== zuletzt.roh) {
    let wert: FokusraumWahl | null = null;
    try {
      wert = roh ? (JSON.parse(roh) as FokusraumWahl) : null;
    } catch {
      wert = null;
    }
    zuletzt = { roh, wert };
  }
  return zuletzt.wert;
}

export function fokusraumSchreiben(wahl: FokusraumWahl | null) {
  try {
    if (wahl) window.localStorage.setItem(SCHLUESSEL, JSON.stringify(wahl));
    else window.localStorage.removeItem(SCHLUESSEL);
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
    zuletzt = { roh: wahl ? JSON.stringify(wahl) : null, wert: wahl };
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

function abonnieren(melden: () => void) {
  window.addEventListener(EREIGNIS, melden);
  window.addEventListener("storage", melden);
  return () => {
    window.removeEventListener(EREIGNIS, melden);
    window.removeEventListener("storage", melden);
  };
}

export function useFokusraum(): FokusraumWahl | null {
  return useSyncExternalStore(abonnieren, fokusraumLesen, () => null);
}
