"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeicherStatus = "gespeichert" | "speichert" | "fehler";

export const SPEICHER_TEXT: Record<SpeicherStatus, string> = {
  gespeichert: "Gespeichert",
  speichert: "Speichert …",
  fehler: "Nicht gespeichert – wird erneut versucht",
};

/**
 * ALL-08: sammelt Änderungen und speichert 1 Sekunde nach der letzten Eingabe.
 * Speichervorgänge laufen nacheinander, damit nichts Älteres Neueres überschreibt.
 * Beim Verlassen (Unmount) wird sofort gespeichert.
 */
export function useAutoSpeichern<T extends object>(speichern: (aenderung: Partial<T>) => Promise<unknown>, verzoegerungMs = 1000) {
  const [status, setStatus] = useState<SpeicherStatus>("gespeichert");
  const ausstehend = useRef<Partial<T>>({});
  const timer = useRef<number | null>(null);
  const kette = useRef<Promise<void>>(Promise.resolve());
  const speichernRef = useRef(speichern);
  const erneutVersuchen = useRef<() => void>(() => {});
  useEffect(() => {
    speichernRef.current = speichern;
  }, [speichern]);

  const jetztSpeichern = useCallback((): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const daten = ausstehend.current;
    if (Object.keys(daten).length === 0) return kette.current;
    ausstehend.current = {};

    kette.current = kette.current.then(async () => {
      try {
        await speichernRef.current(daten);
        if (Object.keys(ausstehend.current).length === 0) setStatus("gespeichert");
      } catch {
        // Neuere Eingaben gewinnen, ältere kommen zurück in die Warteschlange.
        ausstehend.current = { ...daten, ...ausstehend.current };
        setStatus("fehler");
        timer.current = window.setTimeout(() => erneutVersuchen.current(), 5000);
      }
    });
    return kette.current;
  }, []);

  useEffect(() => {
    erneutVersuchen.current = () => void jetztSpeichern();
  }, [jetztSpeichern]);

  const aendern = useCallback(
    (teil: Partial<T>) => {
      ausstehend.current = { ...ausstehend.current, ...teil };
      setStatus("speichert");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void jetztSpeichern(), verzoegerungMs);
    },
    [jetztSpeichern, verzoegerungMs],
  );

  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => {
      if (Object.keys(ausstehend.current).length > 0) {
        void jetztSpeichern();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warnen);
    return () => {
      window.removeEventListener("beforeunload", warnen);
      void jetztSpeichern();
    };
  }, [jetztSpeichern]);

  return { status, aendern, jetztSpeichern };
}
