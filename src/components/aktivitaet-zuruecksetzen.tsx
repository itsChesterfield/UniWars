"use client";

import { useEffect } from "react";
import { LETZTE_AKTIVITAET } from "@/lib/inaktivitaet";

/** Auf der Anmeldeseite: alten Aktivitäts-Zeitstempel löschen, damit nach dem Login nicht sofort abgemeldet wird */
export function AktivitaetZuruecksetzen() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(LETZTE_AKTIVITAET);
    } catch {
      // ohne Speicher nichts zu tun
    }
  }, []);
  return null;
}
