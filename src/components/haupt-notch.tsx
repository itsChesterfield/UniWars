"use client";

import Link from "next/link";
import { useEffect, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";

/**
 * Notch des Zentralen Hubs: schmale Leiste oben mit den Bereichen.
 * Alle Bereiche sind schon geladen – ein Klick blendet nur um und ändert die Adresse
 * (window.history.pushState, von Next.js mitverfolgt), ohne neuen Server-Aufruf.
 * Zurück-Taste, Lesezeichen und „In neuem Tab öffnen“ funktionieren wie bei echten Seiten.
 * Ein gesetzter Fach-Filter bleibt beim Wechsel erhalten.
 */
export function HauptNotch({ aktiv }: { aktiv: Bereich }) {
  const fachId = useSearchParams().get("fachId");

  // Tab-Titel passend zum Bereich, auch bei Zurück/Vor
  useEffect(() => {
    const b = BEREICHE.find((x) => x.bereich === aktiv);
    document.title = !b || b.bereich === "uebersicht" ? "UniVerse" : `${b.name} · UniVerse`;
  }, [aktiv]);

  function wechseln(e: MouseEvent<HTMLAnchorElement>, href: string) {
    // Strg/Cmd/Shift/Mittelklick: normales Verhalten (neuer Tab usw.)
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", href);
  }

  return (
    <nav className="haupt-notch" aria-label="Bereiche">
      {BEREICHE.map((b) => {
        const href = fachId && b.bereich !== "fortschritt" && b.bereich !== "faecher" ? `${b.href}?fachId=${encodeURIComponent(fachId)}` : b.href;
        return (
          <Link
            key={b.bereich}
            href={href}
            prefetch={false}
            onClick={(e) => wechseln(e, href)}
            className={b.bereich === aktiv ? "an" : ""}
            aria-current={b.bereich === aktiv ? "page" : undefined}
          >
            {b.name}
          </Link>
        );
      })}
    </nav>
  );
}
