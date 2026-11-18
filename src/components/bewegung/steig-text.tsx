import type { CSSProperties } from "react";
import { zerlegen } from "@/lib/bewegung/steigen";

/**
 * Text, dessen Buchstaben aus einer Maske steigen (nur transform, siehe `.steig` in globals.css).
 * Für Screenreader steht der ganze Text einmal unsichtbar da, die einzelnen Buchstaben sind versteckt.
 * Ohne JavaScript und bei reduzierter Bewegung steht der Text sofort.
 */
export function SteigText({ text, start = 0, schritt = 15, akzent }: { text: string; start?: number; schritt?: number; akzent?: string[] }) {
  return (
    <span className="steig">
      <span className="sr-only">{text}</span>
      {zerlegen(text, start, schritt).map((w, i) => (
        <span key={i} className={`steig-wort${akzent?.includes(w.text) ? " akzent" : ""}`} aria-hidden="true">
          {w.buchstaben.map((b, j) => (
            <span key={j} className="steig-z" style={{ "--d": `${b.verzoegerung}ms`, "--h": `${b.hoehe}%` } as CSSProperties}>
              {b.zeichen}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
