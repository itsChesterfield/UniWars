/**
 * KI-16.1: Protokoll fuer den Whiteboard-Modus (live gezeichnete Erklaerung).
 *
 * Die KI gibt einen Strom von NDJSON-Zeilen aus, eine Zeile pro Schritt. Jede
 * Zeile ist ein kleines JSON-Objekt mit einem Feld `typ`. Weil die Zeilen in der
 * Reihenfolge kommen, in der die KI sie schreibt, ist die Verschraenkung von
 * Erklaertext (`sagen`) und Zeichnung automatisch richtig.
 *
 * Die KI malt auf einer Tafel und bestimmt die Plaetze selbst (Koordinaten auf
 * einem Feld, Richtwert 1000 breit, siehe CANVAS_BREITE). Sie setzt dazu
 * handgezeichnete Sinnbilder aus dem Katalog (`bild`), freie Linien und Pfeile,
 * freie Stift-Striche und Text an beliebige Stellen. So entstehen echte
 * Tafelbilder, nicht nur Diagramme.
 *
 * Server (Route) und Client (Stream-Leser) importieren beide aus dieser Datei.
 */

/** Richtwert fuer die Breite der Tafel in Tafel-Einheiten. */
export const CANVAS_BREITE = 1000;

/** Textstueck an die laufende Chat-Antwort anhaengen. */
export type WbSagen = { typ: "sagen"; text: string };
/** Ueberschrift oben auf die Tafel (einmalig, optional). */
export type WbTitel = { typ: "titel"; text: string };
/** Ein handgezeichnetes Sinnbild aus dem Katalog, zentriert auf (x,y). */
export type WbBild = { typ: "bild"; symbol: string; x: number; y: number; groesse: number };
/** Beschriftung an einer Stelle (Mittelpunkt x,y). */
export type WbText = { typ: "text"; text: string; x: number; y: number; groesse: number };
/** Pfeil von (x1,y1) nach (x2,y2), optional beschriftet. */
export type WbPfeil = { typ: "pfeil"; x1: number; y1: number; x2: number; y2: number; label?: string };
/** Einfache Verbindungslinie ohne Spitze. */
export type WbLinie = { typ: "linie"; x1: number; y1: number; x2: number; y2: number };
/** Freier Stift-Strich (flache Punktliste [x0,y0,x1,y1,...]) in Tafel-Einheiten. */
export type WbStrich = { typ: "strich"; punkte: number[] };
/** Ende; der Client schliesst die Zeichnung ab. */
export type WbFertig = { typ: "fertig" };

/** Ereignisse, die etwas auf die Tafel legen. */
export type WbZeichenEreignis = WbBild | WbText | WbPfeil | WbLinie | WbStrich;
/** Alle Ereignisse des Protokolls. */
export type WbEreignis = WbSagen | WbTitel | WbZeichenEreignis | WbFertig;

export const MAX_SAGEN_ZEICHEN = 600;
export const MAX_TEXT_ZEICHEN = 80;
export const MAX_SYMBOL_ZEICHEN = 40;
export const MAX_STRICH_PUNKTE = 400;

const GROESSE_VORGABE = 120;
const GROESSE_MIN = 20;
const GROESSE_MAX = 500;
const TEXT_GROESSE_VORGABE = 24;
const TEXT_GROESSE_MIN = 10;
const TEXT_GROESSE_MAX = 90;
const KOORD_GRENZE = 4000;

function text(wert: unknown, max: number): string | null {
  if (typeof wert !== "string") return null;
  const t = wert.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function zahl(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) && Math.abs(wert) <= KOORD_GRENZE ? wert : null;
}

function spanne(wert: unknown, vorgabe: number, min: number, max: number): number {
  const n = typeof wert === "number" && Number.isFinite(wert) ? wert : vorgabe;
  return Math.min(max, Math.max(min, n));
}

/**
 * Liest genau eine Protokollzeile und gibt ein gueltiges Ereignis zurueck oder
 * `null`, wenn die Zeile leer, kein JSON oder nicht protokollkonform ist.
 * Bewusst robust: Server und Client verwerfen `null`-Zeilen, statt abzustuerzen
 * (KI-ALL-09). Reihenfolge und Sinn pruefen hier nicht, das macht der Aufbau.
 */
export function ereignisLesen(zeile: string): WbEreignis | null {
  const roh = zeile.trim();
  if (!roh) return null;
  let wert: unknown;
  try {
    wert = JSON.parse(roh);
  } catch {
    return null;
  }
  if (!wert || typeof wert !== "object") return null;
  const e = wert as Record<string, unknown>;
  switch (e.typ) {
    case "sagen": {
      const t = text(e.text, MAX_SAGEN_ZEICHEN);
      return t ? { typ: "sagen", text: t } : null;
    }
    case "titel": {
      const t = text(e.text, MAX_TEXT_ZEICHEN);
      return t ? { typ: "titel", text: t } : null;
    }
    case "bild": {
      const symbol = text(e.symbol, MAX_SYMBOL_ZEICHEN);
      const x = zahl(e.x);
      const y = zahl(e.y);
      if (!symbol || x === null || y === null) return null;
      return { typ: "bild", symbol, x, y, groesse: spanne(e.groesse, GROESSE_VORGABE, GROESSE_MIN, GROESSE_MAX) };
    }
    case "text": {
      const t = text(e.text, MAX_TEXT_ZEICHEN);
      const x = zahl(e.x);
      const y = zahl(e.y);
      if (!t || x === null || y === null) return null;
      return { typ: "text", text: t, x, y, groesse: spanne(e.groesse, TEXT_GROESSE_VORGABE, TEXT_GROESSE_MIN, TEXT_GROESSE_MAX) };
    }
    case "pfeil":
    case "linie": {
      const x1 = zahl(e.x1);
      const y1 = zahl(e.y1);
      const x2 = zahl(e.x2);
      const y2 = zahl(e.y2);
      if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
      if (e.typ === "linie") return { typ: "linie", x1, y1, x2, y2 };
      const label = text(e.label, MAX_TEXT_ZEICHEN);
      return label ? { typ: "pfeil", x1, y1, x2, y2, label } : { typ: "pfeil", x1, y1, x2, y2 };
    }
    case "strich": {
      if (!Array.isArray(e.punkte)) return null;
      const punkte = e.punkte.slice(0, MAX_STRICH_PUNKTE).map((v) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= KOORD_GRENZE ? v : null));
      if (punkte.length < 4 || punkte.length % 2 !== 0 || punkte.some((v) => v === null)) return null;
      return { typ: "strich", punkte: punkte as number[] };
    }
    case "fertig":
      return { typ: "fertig" };
    default:
      return null;
  }
}
