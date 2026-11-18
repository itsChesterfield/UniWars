"use client";

import { useState } from "react";
import { rollZeichen } from "@/lib/bewegung";

/**
 * Wert, der beim Wechsel rollt (wie die Preise bei Mistral): Der alte Wert schiebt sich in seiner Zeile nach oben
 * hinaus, der neue kommt von unten. Geänderte Zeichen rollen einzeln und um 30 ms versetzt.
 * Für Zähler und Zahlen, nicht für Text, der beim Lesen stört. Bei reduzierter Bewegung wird nur überblendet.
 */
export function RollText({ wert, className }: { wert: string; className?: string }) {
  const [stand, setStand] = useState<{ wert: string; alt: string | null; n: number }>({ wert, alt: null, n: 0 });
  if (stand.wert !== wert) setStand({ wert, alt: stand.wert, n: stand.n + 1 });

  const zeichen = rollZeichen(stand.alt, wert);
  return (
    <span className={`roll${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{wert}</span>
      <span className="roll-reihe" aria-hidden key={stand.n}>
        {zeichen.map((z, i) =>
          z.alt == null ? (
            <span key={i} className="roll-fest">
              {z.neu}
            </span>
          ) : (
            <span key={i} className="roll-platz" style={{ "--roll-v": `${z.verzoegerung}ms` } as React.CSSProperties}>
              <span className="roll-alt">{z.alt}</span>
              <span className="roll-neu">{z.neu}</span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
