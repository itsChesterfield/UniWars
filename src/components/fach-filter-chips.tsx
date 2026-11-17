"use client";

import type { CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { FachOption } from "@/lib/fach-option";
import { track } from "@/lib/analytics";

/** Design B3: Fach-Filter als getönte Pillen ohne Rand; die gewählte trägt den Akzent (aria-pressed). */
export function FachFilterChips({ faecher }: { faecher: FachOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aktivFachId = searchParams.get("fachId");

  function setFilter(fachId: string | null) {
    track("fach_filter_gesetzt", { alle: fachId === null });
    const params = new URLSearchParams(searchParams.toString());
    if (fachId) {
      params.set("fachId", fachId);
    } else {
      params.delete("fachId");
    }
    const query = params.toString();
    // Gefiltert wird im Browser (alle Daten des Hubs sind schon geladen): nur die Adresse ändern, ohne Server-Aufruf.
    // Next.js verfolgt pushState mit (useSearchParams), Zurück-Taste und Lesezeichen funktionieren weiter.
    window.history.pushState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  if (faecher.length === 0) return null;

  return (
    <div className="fach-filter-chips" role="group" aria-label="Nach Fach filtern">
      <button
        type="button"
        className="filter-chip"
        aria-pressed={!aktivFachId}
        onClick={() => setFilter(null)}
      >
        Alle Fächer
      </button>
      {faecher.map((f) => (
        <button
          key={f.id}
          type="button"
          className="filter-chip"
          aria-pressed={aktivFachId === f.id}
          onClick={() => setFilter(f.id)}
        >
          <i aria-hidden style={{ "--c": f.farbe ?? "var(--text-3)" } as CSSProperties} />
          <span>{f.name}</span>
        </button>
      ))}
    </div>
  );
}
