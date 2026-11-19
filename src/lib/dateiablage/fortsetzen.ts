"use client";

import { browserWertLesen, browserWertSchreiben } from "@/lib/browser-wert";

type Position =
  | { art: "praesentation"; folieId: string }
  | { art: "transkript"; teil: number; sekunde: number };

function schluessel(userId: string, id: string) { return `uniwars-ablage-position-v1:${userId}:${id}`; }

export function positionMerken(userId: string, id: string, position: Position) {
  const key = schluessel(userId, id);
  const roh = JSON.stringify(position);
  if (browserWertLesen(key) !== roh) browserWertSchreiben(key, roh);
}

export function positionLesen(userId: string, id: string): Position | null {
  try {
    const wert = JSON.parse(browserWertLesen(schluessel(userId, id)) ?? "null") as Position | null;
    if (wert?.art === "praesentation" && typeof wert.folieId === "string") return wert;
    if (wert?.art === "transkript" && Number.isInteger(wert.teil) && wert.teil > 0 && Number.isFinite(wert.sekunde) && wert.sekunde >= 0) return wert;
    return null;
  } catch { return null; }
}
