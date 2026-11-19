import { bildUrl } from "@/components/hubs/bild-auswahl";
import { SVG_SCHRIFT } from "@/lib/zeichnen/ansicht";
import * as wb from "@/lib/whiteboard/elemente";

function pfeilSpitze(e: wb.Linie) {
  const winkel = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
  const laenge = 10 + e.staerke * 2.5;
  const a = winkel + Math.PI - 0.45;
  const b = winkel + Math.PI + 0.45;
  return `M ${e.x2 + laenge * Math.cos(a)} ${e.y2 + laenge * Math.sin(a)} L ${e.x2} ${e.y2} L ${e.x2 + laenge * Math.cos(b)} ${e.y2 + laenge * Math.sin(b)}`;
}

/** Ein Element mit inline-Attributen (wichtig für den PNG-Export). */
export function ElementZeichnen({ e }: { e: wb.Element }) {
  const strich = { stroke: e.farbe, strokeWidth: e.staerke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const treffer = { stroke: "transparent", strokeWidth: e.staerke + 14, fill: "none" };
  switch (e.typ) {
    case "stift": {
      const d = wb.stiftPfad(e.punkte);
      return (
        <>
          <path d={d} {...treffer} />
          <path d={d} {...strich} />
        </>
      );
    }
    case "linie":
      return (
        <>
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} {...treffer} />
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} {...strich} />
          {e.pfeil && <path d={pfeilSpitze(e)} {...strich} />}
        </>
      );
    case "rechteck":
      return <rect x={e.x} y={e.y} width={e.b} height={e.h} rx={4} {...strich} fill="transparent" />;
    case "kreis":
      return <ellipse cx={e.x + e.b / 2} cy={e.y + e.h / 2} rx={Math.abs(e.b / 2)} ry={Math.abs(e.h / 2)} {...strich} fill="transparent" />;
    case "text":
      return (
        <text x={e.x} y={e.y} fill={e.farbe} fontSize={e.groesse} style={{ fontFamily: SVG_SCHRIFT }} dominantBaseline="hanging">
          {e.text.split("\n").map((z, i) => (
            <tspan key={i} x={e.x} dy={i === 0 ? 0 : e.groesse * 1.25}>
              {z || " "}
            </tspan>
          ))}
        </text>
      );
    case "bild":
      return <image href={bildUrl(e.datei_id)} x={e.x} y={e.y} width={e.b} height={e.h} preserveAspectRatio="none" />;
  }
}
