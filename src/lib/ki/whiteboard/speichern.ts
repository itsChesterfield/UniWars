/**
 * KI-16.6: Eine Tafel in echte Whiteboard-Elemente umwandeln, damit „Als
 * Whiteboard speichern" ueber die bestehende Whiteboard-Infrastruktur geht
 * (keine neue Tabelle). Sinnbilder und freie Striche werden zu `stift`-Strichen,
 * Pfeile und Linien zu `linie`, Beschriftungen zu `text`.
 */
import { WB_FARBEN, neueId, type Element } from "../../whiteboard/elemente.ts";
import { kreisStrich, stiftZufall } from "./skizze.ts";
import { sinnbildStriche } from "./symbole.ts";
import type { Zeichnung } from "./zeichnung.ts";

const FARBE = WB_FARBEN[0].wert;
const STAERKE = 4;

function stift(punkte: number[]): Element {
  return { id: neueId(), typ: "stift", farbe: FARBE, staerke: STAERKE, punkte };
}

function skalieren(punkte: number[], ox: number, oy: number, s: number): number[] {
  const raus = new Array<number>(punkte.length);
  for (let i = 0; i + 1 < punkte.length; i += 2) {
    raus[i] = ox + punkte[i] * s;
    raus[i + 1] = oy + punkte[i + 1] * s;
  }
  return raus;
}

function textElement(text: string, x: number, y: number, groesse: number): Element {
  const breite = text.length * groesse * 0.55;
  return { id: neueId(), typ: "text", farbe: FARBE, staerke: STAERKE, x: x - breite / 2, y: y - groesse / 2, text, groesse };
}

/** Wandelt die Tafel in eine Liste von Whiteboard-Elementen (absolute Koordinaten). */
export function zeichnungZuElementen(z: Zeichnung): Element[] {
  const elemente: Element[] = [];
  if (z.titel?.trim()) elemente.push(textElement(z.titel.trim(), 240, 24, 32));

  for (let i = 0; i < z.elemente.length; i++) {
    const e = z.elemente[i];
    if (e.typ === "strich") {
      elemente.push(stift(e.punkte));
    } else if (e.typ === "text") {
      elemente.push(textElement(e.text, e.x, e.y, e.groesse));
    } else if (e.typ === "linie" || e.typ === "pfeil") {
      elemente.push({ id: neueId(), typ: "linie", farbe: FARBE, staerke: STAERKE, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, pfeil: e.typ === "pfeil" });
      if (e.typ === "pfeil" && e.label) elemente.push(textElement(e.label, (e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2 - 16, 22));
    } else {
      // bild
      const rnd = stiftZufall(`bild:${i}:${e.symbol}`);
      const s = e.groesse / 100;
      const ox = e.x - e.groesse / 2;
      const oy = e.y - e.groesse / 2;
      const striche = sinnbildStriche(e.symbol, rnd) ?? [kreisStrich(50, 50, 38, rnd)];
      for (const strich of striche) elemente.push(stift(skalieren(strich, ox, oy, s)));
      if (!sinnbildStriche(e.symbol, stiftZufall(`pruef:${e.symbol}`))) elemente.push(textElement(e.symbol, e.x, e.y, 18));
    }
  }
  return elemente;
}
