"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Skelett } from "@/components/skelett";
import { skelettForm } from "@/lib/skelett";

/** Ab hier ist das Skelett sichtbar (CSS blendet es erst nach 300 ms ein, DESIGN.md Abschnitt 7) */
const SICHTBAR_AB_MS = 300;

/**
 * Sofortige Rückmeldung beim Wechsel: Rahmen bleibt stehen, der Inhalt zeigt ein Skelett in der Form des Ziels.
 * Bewusst eine Datei für alle Bereiche statt je eine `loading.tsx` pro Ordner: Beim Wechsel zwischen Bereichen
 * greift immer diese Grenze der Gruppe zuerst. Eigene Dateien darunter hätten ein zweites Skelett nachgeschoben.
 * Beim Wechsel zeigt `usePathname` schon das Ziel.
 *
 * Erscheinen: War das Skelett zu sehen, blendet der Inhalt danach als ganze Fläche ein (`data-erscheinen="flaeche"`),
 * statt hart an seine Stelle zu springen. Kurze Ladezeiten übernimmt der Seitenwechsel (View Transition).
 */
export default function Laedt() {
  useEffect(() => {
    const start = performance.now();
    return () => {
      if (performance.now() - start < SICHTBAR_AB_MS) return;
      const html = document.documentElement;
      html.setAttribute("data-erscheinen", "flaeche");
      window.setTimeout(() => {
        if (html.getAttribute("data-erscheinen") === "flaeche") html.removeAttribute("data-erscheinen");
      }, 600);
    };
  }, []);
  return <Skelett form={skelettForm(usePathname())} />;
}
