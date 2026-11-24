"use client";

/**
 * KI-16.5: Whiteboard-Renderer. Zeichnet die Tafel handgemalt mit dem Stift.
 * Die KI platziert handgezeichnete Sinnbilder, freie Linien, Pfeile, Striche und
 * Text frei auf der Flaeche (Koordinaten in Tafel-Einheiten). Neue Striche
 * "zeichnen" sich (stroke-dashoffset), die Striche eines Sinnbilds nacheinander,
 * sodass es wie gemalt wirkt.
 *
 * Reiner Darsteller: er bekommt die Tafel als Prop. Das Tempo (ein Element nach
 * dem anderen) steuert der Aufrufer, der die Ereignisse nach und nach anwendet.
 */
import { useMemo } from "react";
import { SVG_SCHRIFT } from "@/lib/zeichnen/ansicht";
import { stiftPfad } from "@/lib/whiteboard/elemente";
import { CANVAS_BREITE, type WbZeichenEreignis } from "@/lib/ki/whiteboard/protokoll";
import { kreisStrich, linieStrich, pfeilStrich, stiftZufall } from "@/lib/ki/whiteboard/skizze";
import { sinnbildStriche } from "@/lib/ki/whiteboard/symbole";
import type { Zeichnung } from "@/lib/ki/whiteboard/zeichnung";

const STRICH_STAERKE = 3;
const STRICH_VERSATZ_MS = 90; // Striche eines Sinnbilds nacheinander malen
const RAND = 40;
const TITEL_BAND = 54;

type Rahmen = { x1: number; y1: number; x2: number; y2: number };

function rahmenVon(e: WbZeichenEreignis): Rahmen {
  switch (e.typ) {
    case "bild":
      return { x1: e.x - e.groesse / 2, y1: e.y - e.groesse / 2, x2: e.x + e.groesse / 2, y2: e.y + e.groesse / 2 };
    case "text": {
      const w = Math.max(e.groesse, e.text.length * e.groesse * 0.55);
      return { x1: e.x - w / 2, y1: e.y - e.groesse / 2, x2: e.x + w / 2, y2: e.y + e.groesse / 2 };
    }
    case "pfeil":
    case "linie":
      return { x1: Math.min(e.x1, e.x2), y1: Math.min(e.y1, e.y2), x2: Math.max(e.x1, e.x2), y2: Math.max(e.y1, e.y2) };
    case "strich": {
      let x1 = Infinity;
      let y1 = Infinity;
      let x2 = -Infinity;
      let y2 = -Infinity;
      for (let i = 0; i + 1 < e.punkte.length; i += 2) {
        x1 = Math.min(x1, e.punkte[i]);
        x2 = Math.max(x2, e.punkte[i]);
        y1 = Math.min(y1, e.punkte[i + 1]);
        y2 = Math.max(y2, e.punkte[i + 1]);
      }
      return Number.isFinite(x1) ? { x1, y1, x2, y2 } : { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
  }
}

/** Lokale Sinnbild-Punkte (0..100) auf die Tafel skalieren und verschieben. */
function skalieren(punkte: number[], ox: number, oy: number, s: number): number[] {
  const raus = new Array<number>(punkte.length);
  for (let i = 0; i + 1 < punkte.length; i += 2) {
    raus[i] = ox + punkte[i] * s;
    raus[i + 1] = oy + punkte[i + 1] * s;
  }
  return raus;
}

export function Whiteboard({ zeichnung, malMs = 340, className }: { zeichnung: Zeichnung; malMs?: number; className?: string }) {
  const titel = zeichnung.titel?.trim();

  const ansicht = useMemo(() => {
    if (zeichnung.elemente.length === 0) {
      return { x: 0, y: titel ? -TITEL_BAND : 0, b: CANVAS_BREITE, h: (titel ? TITEL_BAND : 0) + 120 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of zeichnung.elemente) {
      const r = rahmenVon(e);
      minX = Math.min(minX, r.x1);
      minY = Math.min(minY, r.y1);
      maxX = Math.max(maxX, r.x2);
      maxY = Math.max(maxY, r.y2);
    }
    const x = Math.min(0, minX) - RAND;
    const obenBand = titel ? TITEL_BAND : 0;
    const y = Math.min(0, minY) - RAND - obenBand;
    const b = Math.max(CANVAS_BREITE, maxX) + RAND - x;
    const h = maxY + RAND - y;
    return { x, y, b, h };
  }, [zeichnung.elemente, titel]);

  const strichStil = { stroke: "var(--text)", strokeWidth: STRICH_STAERKE, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const malen = (index = 0) => ({
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: 1,
    style: { animation: `ki-wb-mal ${malMs}ms ease forwards`, animationDelay: `${index * STRICH_VERSATZ_MS}ms` },
  });
  const einblenden = (verzoegerung: number) => ({ style: { animation: `ki-wb-ein 220ms ease forwards`, animationDelay: `${verzoegerung}ms`, opacity: 0 } });

  return (
    <div className={className} style={{ width: "100%", borderRadius: 6, border: "1px solid var(--linie-2)", background: "var(--flaeche-2)", overflow: "hidden" }}>
      <style>{`
        @keyframes ki-wb-mal { to { stroke-dashoffset: 0; } }
        @keyframes ki-wb-ein { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg
        viewBox={`${ansicht.x} ${ansicht.y} ${ansicht.b} ${ansicht.h}`}
        width="100%"
        role="img"
        aria-label={titel ? `Handzeichnung: ${titel}` : "Handzeichnung"}
        style={{ display: "block", fontFamily: SVG_SCHRIFT }}
      >
        {titel && (
          <text
            x={ansicht.x + ansicht.b / 2}
            y={ansicht.y + 30}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text)"
            fontSize={30}
            fontWeight={650}
            {...einblenden(0)}
          >
            {titel}
          </text>
        )}
        {zeichnung.elemente.map((e, i) => (
          <Element key={i} e={e} index={i} malen={malen} einblenden={einblenden} malMs={malMs} strichStil={strichStil} />
        ))}
      </svg>
    </div>
  );
}

function Element({
  e,
  index,
  malen,
  einblenden,
  malMs,
  strichStil,
}: {
  e: WbZeichenEreignis;
  index: number;
  malen: (i?: number) => object;
  einblenden: (v: number) => object;
  malMs: number;
  strichStil: object;
}) {
  if (e.typ === "text") {
    return (
      <text x={e.x} y={e.y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-2)" fontSize={e.groesse} fontWeight={520} {...einblenden(120)}>
        {e.text}
      </text>
    );
  }
  if (e.typ === "strich") {
    return <path d={stiftPfad(e.punkte)} {...strichStil} {...malen(0)} />;
  }
  if (e.typ === "linie" || e.typ === "pfeil") {
    const rnd = stiftZufall(`v:${index}`);
    const linie = stiftPfad(linieStrich(e.x1, e.y1, e.x2, e.y2, rnd));
    return (
      <g {...strichStil} stroke="var(--text-2)">
        <path d={linie} {...malen(0)} />
        {e.typ === "pfeil" && <path d={stiftPfad(pfeilStrich(e.x1, e.y1, e.x2, e.y2, 16))} {...malen(1)} />}
        {e.typ === "pfeil" && e.label && (
          <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 10} textAnchor="middle" fill="var(--text-2)" stroke="none" fontSize={20} {...einblenden(malMs)}>
            {e.label}
          </text>
        )}
      </g>
    );
  }
  // bild
  const rnd = stiftZufall(`bild:${index}:${e.symbol}`);
  const s = e.groesse / 100;
  const ox = e.x - e.groesse / 2;
  const oy = e.y - e.groesse / 2;
  const striche = sinnbildStriche(e.symbol, rnd);
  if (!striche) {
    // Unbekanntes Sinnbild: Kreis plus Name, damit nichts leer bleibt.
    return (
      <g {...strichStil}>
        <path d={stiftPfad(skalieren(kreisStrich(50, 50, 38, rnd), ox, oy, s))} {...malen(0)} />
        <text x={e.x} y={e.y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-2)" stroke="none" fontSize={18} {...einblenden(malMs)}>
          {e.symbol}
        </text>
      </g>
    );
  }
  return (
    <g {...strichStil}>
      {striche.map((strich, k) => (
        <path key={k} d={stiftPfad(skalieren(strich, ox, oy, s))} {...malen(k)} />
      ))}
    </g>
  );
}
