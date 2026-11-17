"use client";

import { usePathname } from "next/navigation";
import { Skelett } from "@/components/skelett";
import { skelettForm } from "@/lib/skelett";

/**
 * Sofortige Rückmeldung beim Wechsel: Rahmen bleibt stehen, der Inhalt zeigt ein Skelett in der Form des Ziels.
 * Bewusst eine Datei für alle Bereiche statt je eine `loading.tsx` pro Ordner: Beim Wechsel zwischen Bereichen
 * greift immer diese Grenze der Gruppe zuerst. Eigene Dateien darunter hätten ein zweites Skelett nachgeschoben.
 * Beim Wechsel zeigt `usePathname` schon das Ziel.
 */
export default function Laedt() {
  return <Skelett form={skelettForm(usePathname())} />;
}
