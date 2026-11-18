"use client";

import { useState, type FocusEvent } from "react";
import { festeFolge } from "@/lib/bewegung/folge";

/**
 * Hält die Reihenfolge einer Liste fest, solange Zeiger oder Fokus darin sind (Bewegung: Abhaken).
 * Rückgabe: die Einträge in fester Reihenfolge und die Ereignisse für das Listen-Element.
 */
export function useFesteFolge<T extends { id: string }>(sortiert: T[]) {
  const [stand, setStand] = useState<string[] | null>(null);
  const [zeiger, setZeiger] = useState(false);
  const [fokus, setFokus] = useState(false);

  const halten = (z: boolean, f: boolean) => {
    if ((z || f) && !stand) setStand(sortiert.map((t) => t.id));
    if (!z && !f) setStand(null);
  };

  const nachId = new Map(sortiert.map((t) => [t.id, t]));
  const folge = festeFolge(stand, sortiert.map((t) => t.id)).map((id) => nachId.get(id)!);

  return {
    folge,
    listeProps: {
      onPointerEnter: () => {
        setZeiger(true);
        halten(true, fokus);
      },
      onPointerLeave: () => {
        setZeiger(false);
        halten(false, fokus);
      },
      onFocus: () => {
        setFokus(true);
        halten(zeiger, true);
      },
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setFokus(false);
        halten(zeiger, false);
      },
    },
  };
}
