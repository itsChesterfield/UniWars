/**
 * KI-16.5: Layout fuer die Zeichnung. Die KI liefert keine Koordinaten, also
 * rechnet der Code sie aus den Kanten: ein einfaches Ebenen-Layout von links
 * nach rechts. Wurzeln (ohne eingehende Kante) stehen links, jede Kante schiebt
 * ihr Ziel eine Spalte weiter nach rechts.
 *
 * Reiner Code ohne React; wird bei jedem neuen Element neu gerechnet, damit sich
 * nichts ueberlappt. Die Komponente laesst die Knoten animiert an ihren neuen
 * Platz gleiten.
 */
import type { KnotenForm } from "./protokoll.ts";
import type { Zeichnung, ZKnoten } from "./zeichnung.ts";

export type Platz = { id: string; label: string; form: KnotenForm; x: number; y: number; b: number; h: number };
export type KantePlatz = { von: string; nach: string; label?: string; x1: number; y1: number; x2: number; y2: number };
export type Layout = { knoten: Platz[]; kanten: KantePlatz[]; breite: number; hoehe: number };

const SPALTE_ABSTAND = 80;
const ZEILE_ABSTAND = 32;
export const KNOTEN_HOEHE = 56;
const MIN_BREITE = 104;
const MAX_BREITE = 240;
/** Lange Beschriftungen begrenzen, damit sie in den Strich passen. */
export const MAX_LABEL_ANZEIGE = 30;

/** Grobe Knotenbreite aus der Beschriftung (einzeilig). */
export function knotenBreite(label: string): number {
  const zeichen = Math.min(label.length, MAX_LABEL_ANZEIGE);
  return Math.min(MAX_BREITE, Math.max(MIN_BREITE, Math.round(zeichen * 8.5) + 36));
}

/** Ebene (Spalte) je Knoten ueber Kanten-Relaxation; robust gegen Zyklen. */
function ebenen(knotenIds: string[], kanten: { von: string; nach: string }[]): Map<string, number> {
  const ebene = new Map<string, number>();
  for (const id of knotenIds) ebene.set(id, 0);
  const grenze = knotenIds.length; // verhindert endloses Wachsen bei Zyklen
  for (let runde = 0; runde < grenze; runde++) {
    let geaendert = false;
    for (const k of kanten) {
      const soll = (ebene.get(k.von) ?? 0) + 1;
      if (soll < grenze && soll > (ebene.get(k.nach) ?? 0)) {
        ebene.set(k.nach, soll);
        geaendert = true;
      }
    }
    if (!geaendert) break;
  }
  return ebene;
}

/** Schnittpunkt der Verbindungslinie mit dem Rand eines Knotens (als Kasten genaehert). */
function randPunkt(zx: number, zy: number, hb: number, hh: number, zielX: number, zielY: number): { x: number; y: number } {
  const dx = zielX - zx;
  const dy = zielY - zy;
  if (dx === 0 && dy === 0) return { x: zx, y: zy };
  const sx = dx !== 0 ? hb / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: zx + dx * s, y: zy + dy * s };
}

export function layoutBerechnen(z: Zeichnung): Layout {
  const idSet = new Set(z.knoten.map((k) => k.id));
  const kanten = z.kanten.filter((k) => idSet.has(k.von) && idSet.has(k.nach));
  const ebene = ebenen([...idSet], kanten);
  const maxEbene = z.knoten.reduce((m, k) => Math.max(m, ebene.get(k.id) ?? 0), 0);

  const spalten: ZKnoten[][] = Array.from({ length: maxEbene + 1 }, () => []);
  for (const k of z.knoten) spalten[ebene.get(k.id) ?? 0].push(k);

  const spalteBreite = spalten.map((sp) => sp.reduce((m, k) => Math.max(m, knotenBreite(k.label)), MIN_BREITE));
  const spalteX: number[] = [];
  let lauf = 0;
  for (let i = 0; i < spalten.length; i++) {
    spalteX.push(lauf);
    lauf += spalteBreite[i] + SPALTE_ABSTAND;
  }
  const breite = Math.max(0, lauf - SPALTE_ABSTAND);

  const spalteHoehe = spalten.map((sp) => (sp.length ? sp.length * KNOTEN_HOEHE + (sp.length - 1) * ZEILE_ABSTAND : 0));
  const hoehe = spalteHoehe.reduce((m, h) => Math.max(m, h), 0);

  const plaetze = new Map<string, Platz>();
  for (let i = 0; i < spalten.length; i++) {
    let y = (hoehe - spalteHoehe[i]) / 2;
    for (const k of spalten[i]) {
      const b = knotenBreite(k.label);
      plaetze.set(k.id, { id: k.id, label: k.label, form: k.form, x: spalteX[i] + (spalteBreite[i] - b) / 2, y, b, h: KNOTEN_HOEHE });
      y += KNOTEN_HOEHE + ZEILE_ABSTAND;
    }
  }

  const kantenPlatz: KantePlatz[] = [];
  for (const kante of z.kanten) {
    const a = plaetze.get(kante.von);
    const b = plaetze.get(kante.nach);
    if (!a || !b) continue;
    const acx = a.x + a.b / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.b / 2;
    const bcy = b.y + b.h / 2;
    const p1 = randPunkt(acx, acy, a.b / 2, a.h / 2, bcx, bcy);
    const p2 = randPunkt(bcx, bcy, b.b / 2, b.h / 2, acx, acy);
    kantenPlatz.push({ von: kante.von, nach: kante.nach, label: kante.label, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }

  return { knoten: [...plaetze.values()], kanten: kantenPlatz, breite, hoehe };
}
