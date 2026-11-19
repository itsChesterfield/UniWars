"use client";

import { browserWertLesen, browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";

type Aktivitaet = { zuletzt: string[]; pins: string[]; lesen: Record<string, boolean> };
const STANDARD: Aktivitaet = { zuletzt: [], pins: [], lesen: {} };

function aktivitaetSchluessel(userId: string) {
  return `uniwars-material-aktivitaet-v1:${userId}`;
}

function aktivitaetLesen(roh: string | null): Aktivitaet {
  if (!roh) return STANDARD;
  try {
    const wert = JSON.parse(roh) as Partial<Aktivitaet>;
    if (Array.isArray(wert.zuletzt) && Array.isArray(wert.pins) && wert.lesen && typeof wert.lesen === "object") {
      return { zuletzt: wert.zuletzt, pins: wert.pins, lesen: wert.lesen };
    }
  } catch {
    // Nach beschädigten Browserdaten mit einer leeren Übersicht fortfahren.
  }
  return STANDARD;
}

export function materialGeoeffnet(userId: string, id: string) {
  const schluessel = aktivitaetSchluessel(userId);
  const aktivitaet = aktivitaetLesen(browserWertLesen(schluessel));
  if (aktivitaet.zuletzt[0] === id) return;
  const zuletzt = [id, ...aktivitaet.zuletzt.filter((x) => x !== id)].slice(0, 12);
  browserWertSchreiben(schluessel, JSON.stringify({ ...aktivitaet, zuletzt }));
}

export function useMaterialAktivitaet(userId: string) {
  const schluessel = aktivitaetSchluessel(userId);
  const aktivitaet = aktivitaetLesen(useBrowserWert(schluessel, ""));
  return {
    ...aktivitaet,
    oeffnen: (id: string) => materialGeoeffnet(userId, id),
    pin(fachId: string | null, id: string) {
      const aktivitaet = aktivitaetLesen(browserWertLesen(schluessel));
      const fachPin = `${fachId ?? "lose"}:${id}`;
      const pins = aktivitaet.pins.includes(fachPin)
        ? aktivitaet.pins.filter((x) => x !== fachPin)
        : [...aktivitaet.pins, fachPin];
      browserWertSchreiben(schluessel, JSON.stringify({ ...aktivitaet, pins }));
    },
    leseliste(id: string, wert: boolean | null) {
      const aktivitaet = aktivitaetLesen(browserWertLesen(schluessel));
      const lesen = { ...aktivitaet.lesen };
      if (wert === null) delete lesen[id];
      else lesen[id] = wert;
      browserWertSchreiben(schluessel, JSON.stringify({ ...aktivitaet, lesen }));
    },
  };
}
