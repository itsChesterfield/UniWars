"use client";

/**
 * KI-16.5: Whiteboard-Renderer. Zeichnet die aktuelle Zeichnung handgemalt mit
 * dem Stift: jeder Knoten ist ein wackeliger Umriss, jede Kante eine handgezogene
 * Linie mit Pfeil. Neue Striche "zeichnen" sich (stroke-dashoffset), Knoten
 * gleiten animiert an ihren neuen Platz, wenn das Layout nachrueckt.
 *
 * Reiner Darsteller: er bekommt die Zeichnung als Prop. Das Tempo (ein Element
 * nach dem anderen) steuert der Aufrufer, der die Ereignisse nach und nach
 * anwendet.
 */
import { useMemo } from "react";
import { SVG_SCHRIFT } from "@/lib/zeichnen/ansicht";
import { stiftPfad } from "@/lib/whiteboard/elemente";
import { layoutBerechnen, MAX_LABEL_ANZEIGE } from "@/lib/ki/whiteboard/layout";
import { knotenStrich, linieStrich, pfeilStrich, stiftZufall } from "@/lib/ki/whiteboard/skizze";
import type { Zeichnung } from "@/lib/ki/whiteboard/zeichnung";

const RAND = 30;
const TITEL_HOEHE = 46;

function kuerzen(text: string): string {
  return text.length > MAX_LABEL_ANZEIGE ? `${text.slice(0, MAX_LABEL_ANZEIGE - 1)}…` : text;
}

export function Whiteboard({
  zeichnung,
  malMs = 320,
  className,
}: {
  zeichnung: Zeichnung;
  malMs?: number;
  className?: string;
}) {
  const layout = useMemo(() => layoutBerechnen(zeichnung), [zeichnung]);
  const titel = zeichnung.titel?.trim();
  const obenVersatz = RAND + (titel ? TITEL_HOEHE : 0);
  const breite = Math.max(layout.breite, 160) + RAND * 2;
  const hoehe = Math.max(layout.hoehe, 72) + obenVersatz + RAND;

  // Stabile Striche je Knoten (Seed aus id), damit sie beim Umbruch nicht zappeln.
  const striche = useMemo(
    () =>
      new Map(
        layout.knoten.map((k) => [k.id, stiftPfad(knotenStrich(k.form, k.b, k.h, stiftZufall(`k:${k.id}`)))] as const),
      ),
    [layout.knoten],
  );

  const stil = { stroke: "var(--text)", strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const kantenStil = { stroke: "var(--text-2)", strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const malen = (dauer = malMs) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1, style: { animation: `ki-wb-mal ${dauer}ms ease forwards` } });

  return (
    <div
      className={className}
      style={{ width: "100%", borderRadius: 6, border: "1px solid var(--linie-2)", background: "var(--flaeche-2)", overflow: "hidden" }}
    >
      <style>{`
        @keyframes ki-wb-mal { to { stroke-dashoffset: 0; } }
        @keyframes ki-wb-ein { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg
        viewBox={`0 0 ${breite} ${hoehe}`}
        width="100%"
        role="img"
        aria-label={titel ? `Handzeichnung: ${titel}` : "Handzeichnung"}
        style={{ display: "block", fontFamily: SVG_SCHRIFT }}
      >
        {titel && (
          <text
            x={breite / 2}
            y={RAND + 4}
            textAnchor="middle"
            dominantBaseline="hanging"
            fill="var(--text)"
            fontSize={18}
            fontWeight={650}
            style={{ animation: "ki-wb-ein 240ms ease forwards" }}
          >
            {kuerzen(titel)}
          </text>
        )}
        <g transform={`translate(${RAND} ${obenVersatz})`}>
          {layout.kanten.map((k) => {
            const rnd = stiftZufall(`e:${k.von}->${k.nach}`);
            const linie = stiftPfad(linieStrich(k.x1, k.y1, k.x2, k.y2, rnd));
            const pfeil = stiftPfad(pfeilStrich(k.x1, k.y1, k.x2, k.y2));
            return (
              <g key={`${k.von}->${k.nach}`} {...kantenStil}>
                <path d={linie} {...malen(malMs)} />
                <path d={pfeil} {...malen(Math.round(malMs * 0.6))} />
                {k.label && (
                  <text
                    x={(k.x1 + k.x2) / 2}
                    y={(k.y1 + k.y2) / 2 - 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--text-2)"
                    stroke="none"
                    fontSize={12}
                    style={{ animation: "ki-wb-ein 220ms ease forwards", animationDelay: `${malMs}ms`, opacity: 0 }}
                  >
                    {kuerzen(k.label)}
                  </text>
                )}
              </g>
            );
          })}
          {layout.knoten.map((k) => (
            <g key={k.id} style={{ transform: `translate(${k.x}px, ${k.y}px)`, transition: `transform ${malMs}ms ease` }}>
              <path d={striche.get(k.id) ?? ""} {...stil} {...malen(malMs)} />
              <text
                x={k.b / 2}
                y={k.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--text)"
                fontSize={14}
                fontWeight={550}
                style={{ animation: "ki-wb-ein 220ms ease forwards", animationDelay: `${malMs}ms`, opacity: 0 }}
              >
                {kuerzen(k.label)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
