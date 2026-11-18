"use client";

import { useState } from "react";

/**
 * Ids, die seit dem letzten Stand dazugekommen sind (Bewegung: neue Zeile erscheint mit kurzem Weg).
 * Beim ersten Zeigen ist nichts neu, damit beim Laden nicht alles einzeln erscheint.
 */
export function useNeueIds(eintraege: { id: string }[]): ReadonlySet<string> {
  const aktuell = eintraege.map((e) => e.id);
  const [stand, setStand] = useState({ ids: aktuell, neu: new Set<string>() });
  if (aktuell.join() !== stand.ids.join()) {
    const vorher = new Set(stand.ids);
    setStand({ ids: aktuell, neu: new Set(aktuell.filter((id) => !vorher.has(id))) });
  }
  return stand.neu;
}
