/** Textmarker im PDF Reader: Farben und Geometrie (ohne DOM, damit testbar). */

export const FARBEN = ["GELB", "GRUEN", "BLAU", "ROSA", "ORANGE"] as const;
export type Farbe = (typeof FARBEN)[number];

export const FARB_INFO: Record<Farbe, { name: string; wert: string }> = {
  GELB: { name: "Gelb", wert: "#fde047" },
  GRUEN: { name: "Grün", wert: "#86efac" },
  BLAU: { name: "Blau", wert: "#93c5fd" },
  ROSA: { name: "Rosa", wert: "#f9a8d4" },
  ORANGE: { name: "Orange", wert: "#fdba74" },
};

export function istFarbe(wert: unknown): wert is Farbe {
  return typeof wert === "string" && (FARBEN as readonly string[]).includes(wert);
}

/** Rechteck relativ zur Seite: x, y, Breite, Höhe – jeweils 0…1. */
export type Rechteck = [number, number, number, number];
type Box = { left: number; top: number; width: number; height: number };

const runden = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Wandelt die Bildschirm-Rechtecke einer Textauswahl in Seiten-relative Rechtecke um.
 * Schneidet sie auf die Seite zu, verwirft Unsinn (leer, ganze Absätze/Seiten)
 * und fasst Stücke derselben Zeile zusammen.
 */
export function rechteckeAusAuswahl(rects: Box[], seite: Box): Rechteck[] {
  if (seite.width <= 0 || seite.height <= 0) return [];
  const roh: Rechteck[] = [];
  for (const r of rects) {
    const links = Math.max(r.left, seite.left);
    const oben = Math.max(r.top, seite.top);
    const rechts = Math.min(r.left + r.width, seite.left + seite.width);
    const unten = Math.min(r.top + r.height, seite.top + seite.height);
    const b = rechts - links;
    const h = unten - oben;
    if (b < 1 || h < 1) continue;
    // Element-Kästen (z. B. die unsichtbare "Ende des Inhalts"-Ebene) sind viel höher als eine Zeile
    if (h / seite.height > 0.08) continue;
    roh.push([(links - seite.left) / seite.width, (oben - seite.top) / seite.height, b / seite.width, h / seite.height]);
  }
  return zusammenfassen(roh).map(([x, y, w, h]) => [runden(x), runden(y), runden(w), runden(h)]);
}

/** Fasst Rechtecke zusammen, die auf derselben Zeile liegen und sich berühren oder überlappen. */
export function zusammenfassen(liste: Rechteck[]): Rechteck[] {
  const sortiert = [...liste].sort((a, b) => a[1] + a[3] / 2 - (b[1] + b[3] / 2) || a[0] - b[0]);
  const ergebnis: Rechteck[] = [];
  for (const r of sortiert) {
    const letzte = ergebnis[ergebnis.length - 1];
    if (letzte && gleicheZeile(letzte, r) && r[0] <= letzte[0] + letzte[2] + 0.012) {
      const x = Math.min(letzte[0], r[0]);
      const y = Math.min(letzte[1], r[1]);
      const rechts = Math.max(letzte[0] + letzte[2], r[0] + r[2]);
      const unten = Math.max(letzte[1] + letzte[3], r[1] + r[3]);
      ergebnis[ergebnis.length - 1] = [x, y, rechts - x, unten - y];
    } else {
      ergebnis.push([...r]);
    }
  }
  return ergebnis;
}

function gleicheZeile(a: Rechteck, b: Rechteck): boolean {
  const mitteA = a[1] + a[3] / 2;
  const mitteB = b[1] + b[3] / 2;
  return Math.abs(mitteA - mitteB) < Math.min(a[3], b[3]) * 0.5;
}

/** Liegt der (Seiten-relative) Punkt in einem der Rechtecke? */
export function punktTrifft(rechtecke: Rechteck[], x: number, y: number): boolean {
  return rechtecke.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
}

/** Prüft gespeicherte Daten, bevor sie gezeichnet werden. */
export function alsRechtecke(wert: unknown): Rechteck[] {
  if (!Array.isArray(wert)) return [];
  return wert.filter(
    (r): r is Rechteck => Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === "number" && Number.isFinite(n)),
  );
}

/** Alle Markierungen als Text, z. B. zum Einfügen in Notizen. */
export function markierungenAlsText(
  dateiName: string,
  liste: { seite: number; text: string; notiz: string | null }[],
): string {
  const zeilen = [`Markierungen aus „${dateiName}“`, ""];
  for (const m of [...liste].sort((a, b) => a.seite - b.seite)) {
    zeilen.push(`S. ${m.seite}: „${m.text.trim()}“`);
    if (m.notiz?.trim()) zeilen.push(`   Notiz: ${m.notiz.trim()}`);
  }
  return zeilen.join("\n");
}
