"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { TimerZustand } from "@/lib/work-station/timer";

// Der Timer-Zustand liegt im Browser, damit er Seitenwechsel und Neuladen übersteht (WS-06).
const SCHLUESSEL = "uniwars-ws-timer-v1";
const listeners = new Set<() => void>();

let zuletztRoh: string | null = null;
let zuletztWert: TimerZustand | null = null;

function rohLesen(): string | null {
  try {
    return window.localStorage.getItem(SCHLUESSEL);
  } catch {
    return null;
  }
}

export function timerLesen(): TimerZustand | null {
  const roh = rohLesen();
  if (roh === zuletztRoh) return zuletztWert;
  zuletztRoh = roh;
  try {
    zuletztWert = roh ? (JSON.parse(roh) as TimerZustand) : null;
  } catch {
    zuletztWert = null;
  }
  return zuletztWert;
}

export function timerSchreiben(zustand: TimerZustand | null) {
  try {
    if (zustand) window.localStorage.setItem(SCHLUESSEL, JSON.stringify(zustand));
    else window.localStorage.removeItem(SCHLUESSEL);
  } catch {
    // Privater Modus o. Ä.: dann gilt der Zustand nur bis zum Neuladen.
    zuletztRoh = zustand ? JSON.stringify(zustand) : null;
    zuletztWert = zustand;
  }
  listeners.forEach((l) => l());
}

function abonnieren(listener: () => void) {
  listeners.add(listener);
  const beiStorage = (e: StorageEvent) => {
    if (e.key === SCHLUESSEL) listener();
  };
  window.addEventListener("storage", beiStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", beiStorage);
  };
}

export function useTimerZustand(): TimerZustand | null {
  return useSyncExternalStore(abonnieren, timerLesen, () => null);
}

/** Aktuelle Zeit, die jede halbe Sekunde weiterläuft, solange `aktiv` ist. */
export function useJetzt(aktiv: boolean): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!aktiv) return;
    const id = window.setInterval(() => setJetzt(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [aktiv]);
  return jetzt;
}

// Fertig gespeicherte Sitzung -> Work-Station-Seite lädt die Tagesübersicht neu.
export const SITZUNG_GESPEICHERT_EVENT = "uniwars:ws-sitzung-gespeichert";
