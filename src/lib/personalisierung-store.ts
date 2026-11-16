"use client";

import { useEffect, useSyncExternalStore } from "react";
import { darstellungSpeichern, setTheme, symbolleisteSpeichern } from "@/app/settings/actions";
import type { Darstellung, Symbolleiste, Theme } from "@/lib/personalisierung";

/**
 * Personalisierung wirkt sofort: Die Wahl gilt im Browser, bis der Server sie bestätigt.
 * Bestätigt er (die Server-Werte sind dann gleich), fällt die Vormerkung weg. Scheitert das Speichern,
 * auch – die Ansicht springt dann auf den gespeicherten Stand zurück.
 */
type Vorgemerkt = { theme?: Theme; darstellung?: Darstellung; symbolleiste?: Symbolleiste };

let vorgemerkt: Vorgemerkt = {};
const hoerer = new Set<() => void>();
const melden = () => hoerer.forEach((h) => h());

function vormerken(teil: Vorgemerkt) {
  vorgemerkt = { ...vorgemerkt, ...teil };
  melden();
}

function verwerfen(k: keyof Vorgemerkt) {
  if (!(k in vorgemerkt)) return;
  const rest = { ...vorgemerkt };
  delete rest[k];
  vorgemerkt = rest;
  melden();
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

/** Der gerade gültige Wert: vorgemerkt, sonst der vom Server. */
export function usePersoenlich<K extends keyof Vorgemerkt>(k: K, server: NonNullable<Vorgemerkt[K]>): NonNullable<Vorgemerkt[K]> {
  const lokal = useSyncExternalStore(
    abonnieren,
    () => vorgemerkt[k],
    () => undefined,
  );
  const gleich = lokal !== undefined && JSON.stringify(lokal) === JSON.stringify(server);
  useEffect(() => {
    if (gleich) verwerfen(k);
  }, [gleich, k]);
  return (lokal ?? server) as NonNullable<Vorgemerkt[K]>;
}

async function speichern<K extends keyof Vorgemerkt>(k: K, wert: NonNullable<Vorgemerkt[K]>, aktion: () => Promise<{ ok: boolean }>): Promise<boolean> {
  vormerken({ [k]: wert } as Vorgemerkt);
  try {
    const { ok } = await aktion();
    if (!ok) verwerfen(k);
    return ok;
  } catch {
    verwerfen(k);
    return false;
  }
}

export const designWaehlen = (theme: Theme) => speichern("theme", theme, () => setTheme(theme));
export const darstellungWaehlen = (d: Darstellung) => speichern("darstellung", d, () => darstellungSpeichern(d));
export const symbolleisteWaehlen = (s: Symbolleiste) => speichern("symbolleiste", s, () => symbolleisteSpeichern(s));

const DUNKEL = "(prefers-color-scheme: dark)";

/** Ob das Gerät gerade dunkel möchte. Auf dem Server: nein. */
export function useSystemDunkel(): boolean {
  return useSyncExternalStore(
    (h) => {
      const mq = window.matchMedia(DUNKEL);
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    },
    () => window.matchMedia(DUNKEL).matches,
    () => false,
  );
}

/** Bewegung reduziert – vom System oder in der Personalisierung gewählt. Für Bewegung, die in JavaScript läuft. */
export function bewegungReduziert(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.bewegung === "reduziert" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
