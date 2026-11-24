/**
 * KI-16.1: Protokoll für den Whiteboard-Modus (live gezeichnete Erklärung).
 *
 * Die KI gibt einen Strom von NDJSON-Zeilen aus, eine Zeile pro Schritt.
 * Jede Zeile ist ein kleines JSON-Objekt mit einem Feld `typ`. Weil die Zeilen
 * in der Reihenfolge kommen, in der die KI sie schreibt, ist die Verschränkung
 * von Erklärtext (`sagen`) und Zeichnung (`knoten`, `kante`, `titel`) automatisch
 * richtig.
 *
 * Server (Route) und Client (Stream-Leser) importieren beide aus dieser einen
 * Datei, damit es keine doppelten Typen gibt.
 */

/** Form eines Knotens auf der Zeichnung. Vorgabe ist `kasten`. */
export type KnotenForm = "kasten" | "ellipse";

/** Textstück an die laufende Chat-Antwort anhängen. */
export type WbSagen = { typ: "sagen"; text: string };
/** Neuen Knoten auf die Zeichnung legen. */
export type WbKnoten = { typ: "knoten"; id: string; label: string; form: KnotenForm };
/** Verbindung zwischen zwei Knoten-`id`s zeichnen. */
export type WbKante = { typ: "kante"; von: string; nach: string; label?: string };
/** Überschrift oben auf die Zeichnung (einmalig, optional). */
export type WbTitel = { typ: "titel"; text: string };
/** Ende; der Client schließt die Zeichnung ab. */
export type WbFertig = { typ: "fertig" };

/** Ein Ereignis des Protokolls. */
export type WbEreignis = WbSagen | WbKnoten | WbKante | WbTitel | WbFertig;

/** Obergrenzen, damit eine kaputte oder bösartige Zeile nichts aufbläht. */
export const MAX_SAGEN_ZEICHEN = 600;
export const MAX_LABEL_ZEICHEN = 120;
export const MAX_ID_ZEICHEN = 64;

const FORMEN = new Set<KnotenForm>(["kasten", "ellipse"]);

function text(wert: unknown, max: number): string | null {
  if (typeof wert !== "string") return null;
  const t = wert.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function id(wert: unknown): string | null {
  return text(wert, MAX_ID_ZEICHEN);
}

/**
 * Liest genau eine Protokollzeile und gibt ein gültiges Ereignis zurück oder
 * `null`, wenn die Zeile leer, kein JSON oder nicht protokollkonform ist.
 *
 * Bewusst robust: Server und Client verwerfen `null`-Zeilen, statt abzustürzen
 * (KI-ALL-09). Eindeutigkeit der `id` und Reihenfolge prüft diese Funktion
 * nicht; das ist Sache des Zusammenbaus der Zeichnung.
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
    case "knoten": {
      const kid = id(e.id);
      const label = text(e.label, MAX_LABEL_ZEICHEN);
      if (!kid || !label) return null;
      const form = FORMEN.has(e.form as KnotenForm) ? (e.form as KnotenForm) : "kasten";
      return { typ: "knoten", id: kid, label, form };
    }
    case "kante": {
      const von = id(e.von);
      const nach = id(e.nach);
      if (!von || !nach) return null;
      const label = text(e.label, MAX_LABEL_ZEICHEN);
      return label ? { typ: "kante", von, nach, label } : { typ: "kante", von, nach };
    }
    case "titel": {
      const t = text(e.text, MAX_LABEL_ZEICHEN);
      return t ? { typ: "titel", text: t } : null;
    }
    case "fertig":
      return { typ: "fertig" };
    default:
      return null;
  }
}
