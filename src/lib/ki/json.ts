/** Hilfen zum Lesen von KI-Antworten im JSON-Format (alle Text-Funktionen). */

/** JSON lesen; bei Text drumherum (z. B. ```json … ```) das erste { bis zum letzten } versuchen. */
export function jsonLesen(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const ende = text.lastIndexOf("}");
    if (start === -1 || ende <= start) return null;
    try {
      return JSON.parse(text.slice(start, ende + 1));
    } catch {
      return null;
    }
  }
}

/** Ein Objekt (kein Array, kein null) oder ein leeres Objekt. */
export function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert && typeof wert === "object" && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {};
}

/** String bereinigen und kürzen; alles andere wird "". */
export function text(wert: unknown, max: number): string {
  return typeof wert === "string" ? wert.replace(/\s+/g, " ").trim().slice(0, max).trim() : "";
}

/** Array von Strings (bereinigt, ohne leere, ohne Duplikate), höchstens `anzahl`. */
export function textListe(wert: unknown, max: number, anzahl: number): string[] {
  if (!Array.isArray(wert)) return [];
  const gesehen = new Set<string>();
  const liste: string[] = [];
  for (const w of wert) {
    const t = text(w, max);
    const schluessel = t.toLocaleLowerCase("de-DE");
    if (!t || gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    liste.push(t);
    if (liste.length >= anzahl) break;
  }
  return liste;
}
