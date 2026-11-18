"use client";

import { useState } from "react";
import { SPEICHER_TEXT, type SpeicherStatus } from "@/lib/hubs/auto-speichern";

/**
 * Speicherstatus mit Lichtspur (Entscheidung 15.11.): Während gespeichert wird, umrundet eine Spur einen Punkt.
 * Ist es gespeichert, schließt sie sich und wird zum Haken. Der Text bleibt daneben stehen.
 */
export function SpeicherStatusAnzeige({ status, text }: { status: SpeicherStatus; text?: string | null }) {
  // Haken nur zeichnen, wenn gerade gespeichert wurde; beim Öffnen steht er ruhig da
  const [stand, setStand] = useState({ status, frisch: false });
  if (stand.status !== status) setStand({ status, frisch: stand.status === "speichert" && status === "gespeichert" });

  return (
    <span className={`speicher-status ${status}`} aria-live="polite">
      {status !== "fehler" && (
        <svg className={`speicher-marke ${status}${stand.frisch ? " frisch" : ""}`} viewBox="-8 -8 16 16" aria-hidden key={status}>
          {status === "speichert" ? (
            <>
              <circle className="speicher-spur" r="6" pathLength={100} transform="rotate(-90)" />
              <circle className="speicher-punkt" r="1.5" />
            </>
          ) : (
            <path className="speicher-haken" d="M-4 0.5 L-1.2 3.3 L4.4 -3.2" pathLength={1} />
          )}
        </svg>
      )}
      {text ?? SPEICHER_TEXT[status]}
    </span>
  );
}
