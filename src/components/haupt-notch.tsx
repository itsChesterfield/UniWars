"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";

/**
 * Notch des Zentralen Hubs: schmale Leiste oben mit den Bereichen als eigene Seiten
 * (wie die Steuerleiste im PDF Reader). Ein gesetzter Fach-Filter bleibt beim Wechsel erhalten.
 */
export function HauptNotch({ aktiv }: { aktiv: Bereich }) {
  const fachId = useSearchParams().get("fachId");
  return (
    <nav className="haupt-notch" aria-label="Bereiche">
      {BEREICHE.map((b) => (
        <Link
          key={b.bereich}
          href={fachId && b.bereich !== "fortschritt" && b.bereich !== "faecher" ? `${b.href}?fachId=${encodeURIComponent(fachId)}` : b.href}
          className={b.bereich === aktiv ? "an" : ""}
          aria-current={b.bereich === aktiv ? "page" : undefined}
        >
          {b.name}
        </Link>
      ))}
    </nav>
  );
}
