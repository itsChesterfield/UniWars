"use client";

import { usePathname } from "next/navigation";
import { IdeaFlag } from "@/components/idee/idea-flag";
import { hubAusPfad } from "@/lib/idee";

/** Zeigt die Flagge des aktuellen Bereichs. Auf Seiten ohne Hub-Zuordnung erscheint nichts. */
export function IdeaFlagAuto() {
  const pfad = usePathname() ?? "";
  const hub = hubAusPfad(pfad);
  if (!hub) return null;
  return <IdeaFlag hub={hub} />;
}
