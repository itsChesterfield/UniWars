"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { hubAusPfad } from "@/lib/hubs/navigation";

/** Transition-Typen der Symbolleiste: das Ziel liegt unter oder über dem aktuellen Bereich. */
export const NACH_UNTEN = "nach-unten";
export const NACH_OBEN = "nach-oben";

/**
 * Design B3, Wechsel zwischen Bereichen (DESIGN.md Abschnitt 7): „mit Richtung“.
 * Das alte Bild geht in 100 ms, das neue kommt 60 ms später in 200 ms, 12 px aus der Klickrichtung.
 * Ohne Typ (Zurück im Browser, Befehlspalette) nur Überblenden. Symbolleiste und Kopfleiste stehen still (CSS).
 * Schlüssel ist der Bereich, nicht der Pfad: Wechsel innerhalb eines Bereichs animieren nicht.
 * Kein eigenes Element: Bereiche verlassen sich auf Regeln wie `.dashboard-main > .pdf-reader`.
 */
export function BereichUebergang({ children }: { children: ReactNode }) {
  const pfad = usePathname();
  const bereich = hubAusPfad(pfad).hub?.href ?? `/${pfad.split("/")[1] ?? ""}`;
  return (
    <ViewTransition
      key={bereich}
      enter={{ [NACH_UNTEN]: "uv-von-unten", [NACH_OBEN]: "uv-von-oben", default: "uv-ein" }}
      exit={{ default: "uv-aus" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
