// Präsentationen (PRÄ-01 … PRÄ-07): Datenmodell der Folien.

export type Layout = "TITEL" | "TEXT" | "BILD" | "ZWEISPALTIG";
export type Design = "HELL" | "DUNKEL" | "GOLD";

export type Folie = {
  id: string;
  layout: Layout;
  titel: string;
  /** TITEL: Untertitel · TEXT: Aufzählung (eine Zeile = ein Punkt) · ZWEISPALTIG: linke Spalte */
  text: string;
  /** ZWEISPALTIG: rechte Spalte */
  text2: string;
  /** BILD: Datei-ID aus der Dateiablage */
  bild: string | null;
};

export const LAYOUTS: { wert: Layout; name: string; beschreibung: string }[] = [
  { wert: "TITEL", name: "Titel", beschreibung: "Großer Titel + Untertitel" },
  { wert: "TEXT", name: "Titel & Text", beschreibung: "Überschrift + Aufzählung" },
  { wert: "BILD", name: "Titel & Bild", beschreibung: "Überschrift + ein Bild" },
  { wert: "ZWEISPALTIG", name: "Zweispaltig", beschreibung: "Überschrift + zwei Textspalten" },
];

export const DESIGNS: { wert: Design; name: string }[] = [
  { wert: "HELL", name: "Hell" },
  { wert: "DUNKEL", name: "Dunkel" },
  { wert: "GOLD", name: "UniWars-Gold" },
];

export const MAX_FOLIEN = 200;

function neueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function neueFolie(layout: Layout, titel = ""): Folie {
  return { id: neueId(), layout, titel, text: "", text2: "", bild: null };
}

export function duplizieren(f: Folie): Folie {
  return { ...f, id: neueId() };
}

const LAYOUT_WERTE = new Set(LAYOUTS.map((l) => l.wert));

/** Robust einlesen (Server und Client). */
export function folienLesen(roh: unknown): Folie[] {
  if (!Array.isArray(roh)) return [];
  return roh.slice(0, MAX_FOLIEN).flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const o = f as Record<string, unknown>;
    const layout = LAYOUT_WERTE.has(o.layout as Layout) ? (o.layout as Layout) : "TEXT";
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    return [
      {
        id: typeof o.id === "string" && o.id ? o.id.slice(0, 64) : neueId(),
        layout,
        titel: text(o.titel, 300),
        text: text(o.text, 5000),
        text2: text(o.text2, 5000),
        bild: typeof o.bild === "string" && /^[0-9a-f-]{36}$/.test(o.bild) ? o.bild : null,
      },
    ];
  });
}

export function designLesen(roh: unknown): Design {
  return roh === "DUNKEL" || roh === "GOLD" ? roh : "HELL";
}

/** Aufzählung: jede nicht leere Zeile ist ein Punkt (führende "-"/"•" werden entfernt). */
export function punkte(text: string): string[] {
  return text
    .split("\n")
    .map((z) => z.replace(/^\s*[-•*]\s?/, "").trim())
    .filter(Boolean);
}

export function verschieben<T>(liste: T[], von: number, nach: number): T[] {
  if (von === nach || von < 0 || nach < 0 || von >= liste.length || nach >= liste.length) return liste;
  const kopie = [...liste];
  const [element] = kopie.splice(von, 1);
  kopie.splice(nach, 0, element);
  return kopie;
}
