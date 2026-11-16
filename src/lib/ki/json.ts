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

/**
 * Rettet die vollständigen Objekte aus einem JSON-Array, auch wenn die Antwort mittendrin
 * abgeschnitten ist (z. B. Token-Limit erreicht): `{"segmente":[{…},{…},{…` → die ersten beiden.
 */
export function arrayElementeRetten(text: string, feld: string): unknown[] {
  const start = text.search(new RegExp(`"${feld}"\\s*:\\s*\\[`));
  if (start === -1) return [];
  let i = text.indexOf("[", start) + 1;
  const ergebnis: unknown[] = [];
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (text[i] !== "{") break;
    // passende schließende Klammer suchen (Zeichenketten beachten)
    let tiefe = 0;
    let inString = false;
    let ende = -1;
    for (let j = i; j < text.length; j++) {
      const z = text[j];
      if (inString) {
        if (z === "\\") j++;
        else if (z === '"') inString = false;
      } else if (z === '"') inString = true;
      else if (z === "{") tiefe++;
      else if (z === "}") {
        tiefe--;
        if (tiefe === 0) {
          ende = j;
          break;
        }
      }
    }
    if (ende === -1) break;
    try {
      ergebnis.push(JSON.parse(text.slice(i, ende + 1)));
    } catch {
      break;
    }
    i = ende + 1;
  }
  return ergebnis;
}

/** Einen einfachen Text-Wert aus (evtl. abgeschnittenem) JSON lesen */
export function textFeldRetten(text: string, feld: string): string {
  const m = new RegExp(`"${feld}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  if (!m) return "";
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}
