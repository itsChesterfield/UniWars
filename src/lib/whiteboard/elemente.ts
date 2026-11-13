// Whiteboard (WB-01 … WB-07): Elemente und Bearbeitung ohne React.

export const WB_FARBEN = [
  { name: "Schwarz", wert: "#2a2318" },
  { name: "Rot", wert: "#e0654a" },
  { name: "Blau", wert: "#4f74b0" },
  { name: "Grün", wert: "#3f8a52" },
  { name: "Gold", wert: "#d9a441" },
  { name: "Lila", wert: "#7c5ba8" },
] as const;

// WB-03: drei Strichstärken
export const STAERKEN = [
  { name: "Dünn", wert: 2 },
  { name: "Mittel", wert: 4 },
  { name: "Dick", wert: 8 },
] as const;

export const MAX_SCHRITTE = 50; // WB-04
export const MAX_ELEMENTE = 3000;

type Basis = { id: string; farbe: string; staerke: number };
export type Stift = Basis & { typ: "stift"; punkte: number[] };
export type Linie = Basis & { typ: "linie"; x1: number; y1: number; x2: number; y2: number; pfeil: boolean };
export type Form = Basis & { typ: "rechteck" | "kreis"; x: number; y: number; b: number; h: number };
export type Text = Basis & { typ: "text"; x: number; y: number; text: string; groesse: number };
export type Bild = Basis & { typ: "bild"; x: number; y: number; b: number; h: number; datei_id: string };
export type Element = Stift | Linie | Form | Text | Bild;

export type Rahmen = { x1: number; y1: number; x2: number; y2: number };

export function neueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/** Textgröße aus der Strichstärke: dünn 18, mittel 26, dick 40. */
export function textGroesse(staerke: number): number {
  return staerke <= 2 ? 18 : staerke <= 4 ? 26 : 40;
}

export function rahmen(e: Element, textBreite: (t: string, px: number) => number = (t, px) => t.length * px * 0.55): Rahmen {
  switch (e.typ) {
    case "stift": {
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
    case "linie":
      return { x1: Math.min(e.x1, e.x2), y1: Math.min(e.y1, e.y2), x2: Math.max(e.x1, e.x2), y2: Math.max(e.y1, e.y2) };
    case "text": {
      const zeilen = e.text.split("\n");
      const breite = Math.max(...zeilen.map((z) => textBreite(z, e.groesse)), e.groesse);
      return { x1: e.x, y1: e.y, x2: e.x + breite, y2: e.y + zeilen.length * e.groesse * 1.25 };
    }
    default:
      return { x1: Math.min(e.x, e.x + e.b), y1: Math.min(e.y, e.y + e.h), x2: Math.max(e.x, e.x + e.b), y2: Math.max(e.y, e.y + e.h) };
  }
}

export function gesamtRahmen(liste: Element[], tb?: (t: string, px: number) => number): Rahmen | null {
  if (!liste.length) return null;
  return liste.map((e) => rahmen(e, tb)).reduce((a, b) => ({
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  }));
}

export function verschieben(e: Element, dx: number, dy: number): Element {
  switch (e.typ) {
    case "stift":
      return { ...e, punkte: e.punkte.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    case "linie":
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    default:
      return { ...e, x: e.x + dx, y: e.y + dy };
  }
}

/** Größe über die Ecke unten rechts ändern (Formen, Bilder); Linien über ihren Endpunkt. */
export function groesseAendern(e: Element, x: number, y: number, seitenverhaeltnis = false): Element {
  if (e.typ === "linie") return { ...e, x2: x, y2: y };
  if (e.typ === "rechteck" || e.typ === "kreis" || e.typ === "bild") {
    let b = Math.max(8, x - e.x);
    let h = Math.max(8, y - e.y);
    if (seitenverhaeltnis && e.b && e.h) {
      const f = Math.max(b / e.b, h / e.h);
      b = e.b * f;
      h = e.h * f;
    }
    return { ...e, b, h };
  }
  return e;
}

/** Rechteck/Kreis mit positiver Breite/Höhe (beim Aufziehen nach links/oben). */
export function normalisieren(e: Element): Element {
  if (e.typ !== "rechteck" && e.typ !== "kreis") return e;
  return { ...e, x: Math.min(e.x, e.x + e.b), y: Math.min(e.y, e.y + e.h), b: Math.abs(e.b), h: Math.abs(e.h) };
}

/** Stiftpunkte ausdünnen (Speicher sparen). */
export function punkteAusduennen(punkte: number[], minAbstand = 1.5): number[] {
  if (punkte.length <= 4) return punkte;
  const ergebnis = [punkte[0], punkte[1]];
  for (let i = 2; i + 1 < punkte.length; i += 2) {
    const lx = ergebnis[ergebnis.length - 2];
    const ly = ergebnis[ergebnis.length - 1];
    if (Math.hypot(punkte[i] - lx, punkte[i + 1] - ly) >= minAbstand || i + 2 >= punkte.length) {
      ergebnis.push(Math.round(punkte[i] * 10) / 10, Math.round(punkte[i + 1] * 10) / 10);
    }
  }
  return ergebnis;
}

/** Glatter Pfad durch die Stiftpunkte (quadratische Bézier über Mittelpunkte). */
export function stiftPfad(p: number[]): string {
  if (p.length < 2) return "";
  if (p.length < 6) return `M ${p[0]} ${p[1]} L ${p[p.length - 2] ?? p[0]} ${p[p.length - 1] ?? p[1]}`;
  let d = `M ${p[0]} ${p[1]}`;
  for (let i = 2; i + 3 < p.length; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2;
    const my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q ${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  d += ` L ${p[p.length - 2]} ${p[p.length - 1]}`;
  return d;
}

const TYPEN = new Set(["stift", "linie", "rechteck", "kreis", "text", "bild"]);

export function elementeLesen(roh: unknown): Element[] {
  const liste = roh && typeof roh === "object" && Array.isArray((roh as { elemente?: unknown }).elemente) ? (roh as { elemente: unknown[] }).elemente : [];
  const zahl = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const ergebnis: Element[] = [];
  for (const r of liste.slice(0, MAX_ELEMENTE)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (!TYPEN.has(o.typ as string)) continue;
    const basis = {
      id: typeof o.id === "string" ? o.id.slice(0, 64) : neueId(),
      farbe: typeof o.farbe === "string" && /^#[0-9a-f]{6}$/i.test(o.farbe) ? o.farbe : WB_FARBEN[0].wert,
      staerke: [2, 4, 8].includes(o.staerke as number) ? (o.staerke as number) : 4,
    };
    switch (o.typ) {
      case "stift":
        if (Array.isArray(o.punkte)) ergebnis.push({ ...basis, typ: "stift", punkte: o.punkte.slice(0, 20000).map(zahl) });
        break;
      case "linie":
        ergebnis.push({ ...basis, typ: "linie", x1: zahl(o.x1), y1: zahl(o.y1), x2: zahl(o.x2), y2: zahl(o.y2), pfeil: o.pfeil === true });
        break;
      case "rechteck":
      case "kreis":
        ergebnis.push({ ...basis, typ: o.typ, x: zahl(o.x), y: zahl(o.y), b: zahl(o.b), h: zahl(o.h) });
        break;
      case "text":
        if (typeof o.text === "string" && o.text.trim())
          ergebnis.push({ ...basis, typ: "text", x: zahl(o.x), y: zahl(o.y), text: o.text.slice(0, 2000), groesse: zahl(o.groesse) || 26 });
        break;
      case "bild":
        if (typeof o.datei_id === "string" && /^[0-9a-f-]{36}$/.test(o.datei_id))
          ergebnis.push({ ...basis, typ: "bild", x: zahl(o.x), y: zahl(o.y), b: zahl(o.b) || 200, h: zahl(o.h) || 150, datei_id: o.datei_id });
        break;
    }
  }
  return ergebnis;
}

/** WB-04: Verlauf mit höchstens 50 Schritten. */
export type Verlauf = { zurueck: Element[][]; vor: Element[][] };

export function merken(v: Verlauf, vorher: Element[]): Verlauf {
  return { zurueck: [...v.zurueck, vorher].slice(-MAX_SCHRITTE), vor: [] };
}
