"use client";

import { useEffect, useState } from "react";
import { sprachStatus, type SprachStatus } from "@/app/(hubs)/ki/sprach-actions";
import { KI_EINWILLIGUNG_EVENT, type EinwilligungsEreignis } from "@/components/ki/ki-einwilligung-dialog";

/** Einmal pro Seitenaufruf laden – alle Mikrofon-/Lautsprecher-Knöpfe teilen sich das Ergebnis. */
let cache: Promise<SprachStatus | null> | null = null;

export function sprachStatusLaden(neu = false): Promise<SprachStatus | null> {
  if (!cache || neu) {
    cache = sprachStatus()
      .then((a) => (a.ok ? a.daten : null))
      .catch(() => null);
  }
  return cache;
}

/** Status für Diktat/Vorlesen; folgt Einwilligungen, die anderswo erteilt oder widerrufen werden. */
export function useSprachStatus(): [SprachStatus | null, (teil: Partial<SprachStatus>) => void] {
  const [status, setStatus] = useState<SprachStatus | null>(null);
  useEffect(() => {
    let ab = false;
    void sprachStatusLaden().then((s) => {
      if (!ab) setStatus(s);
    });
    const geaendert = (e: Event) => {
      const { art, an } = (e as CustomEvent<EinwilligungsEreignis>).detail;
      setStatus((s) => (s ? { ...s, ...(art === "text" ? { eingewilligt: an } : { audioEingewilligt: an }) } : s));
      void sprachStatusLaden(true);
    };
    window.addEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
    return () => {
      ab = true;
      window.removeEventListener(KI_EINWILLIGUNG_EVENT, geaendert);
    };
  }, []);
  return [status, (teil) => setStatus((s) => (s ? { ...s, ...teil } : s))];
}

/** Persönliche Einstellungen auf diesem Gerät (Standard: aus). */
export const SPRACH_EINSTELLUNGEN = {
  diktatSofortSenden: "uniwars-ki-diktat-sofort-senden",
  automatischVorlesen: "uniwars-ki-automatisch-vorlesen",
} as const;

export function einstellungLesen(schluessel: string): boolean {
  try {
    return window.localStorage.getItem(schluessel) === "an";
  } catch {
    return false;
  }
}

export function einstellungSetzen(schluessel: string, an: boolean) {
  try {
    window.localStorage.setItem(schluessel, an ? "an" : "aus");
  } catch {
    // ohne Speicher bleibt es für diese Sitzung beim Standard
  }
}
