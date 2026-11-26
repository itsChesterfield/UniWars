/**
 * KI-16.2: Prompt und Few-Shot fuer den Whiteboard-Modus.
 *
 * Der System-Prompt beschreibt das NDJSON-Protokoll aus protokoll.ts, den
 * Sinnbild-Katalog und das Koordinatensystem und verlangt verschraenktes
 * Erklaeren (erst sagen, dann zeichnen). Nutzerinhalte stehen zwischen
 * <quelle>-Markern und sind Material, keine Anweisung (KI-ALL-06).
 */
import { CANVAS_BREITE } from "./protokoll.ts";
import { SYMBOL_NAMEN } from "./symbole.ts";
import { einbetten, kuerzen, MATERIAL_REGEL } from "../material.ts";

export const MAX_FRAGE_ZEICHEN = 500;
export const MAX_KONTEXT_ZEICHEN = 6000;

/** Ein kurzes, korrektes Beispiel, damit das Format sitzt (Few-Shot wirkt stark). */
const BEISPIEL = [
  '{"typ":"titel","text":"Wasserkreislauf"}',
  '{"typ":"sagen","text":"Die Sonne erwaermt das Wasser im Meer."}',
  '{"typ":"bild","symbol":"sonne","x":170,"y":130,"groesse":120}',
  '{"typ":"bild","symbol":"wasser","x":500,"y":520,"groesse":90}',
  '{"typ":"pfeil","x1":210,"y1":170,"x2":470,"y2":480,"label":"Waerme"}',
  '{"typ":"sagen","text":"Das Wasser verdunstet und steigt als Dampf nach oben."}',
  '{"typ":"bild","symbol":"wolke","x":500,"y":150,"groesse":150}',
  '{"typ":"pfeil","x1":500,"y1":470,"x2":500,"y2":230}',
  '{"typ":"fertig"}',
].join("\n");

export function whiteboardSystemPrompt(): string {
  return [
    "Du erklaerst ein Thema, indem du es live auf eine Tafel malst und dazu sprichst. Schreib auf Deutsch.",
    "",
    "Gib ausschliesslich NDJSON aus: ein JSON-Objekt pro Zeile, nichts davor oder dahinter, kein Markdown, keine Code-Bloecke, keine Leerzeilen.",
    "",
    "Diese Zeilentypen gibt es:",
    '- {"typ":"titel","text":"..."} einmal am Anfang, kurze Ueberschrift.',
    '- {"typ":"sagen","text":"..."} ein Stueck Erklaerung fuer den Chat.',
    '- {"typ":"bild","symbol":"name","x":Zahl,"y":Zahl,"groesse":Zahl} ein handgezeichnetes Sinnbild, zentriert auf (x,y).',
    '- {"typ":"text","text":"...","x":Zahl,"y":Zahl} eine kurze Beschriftung an einer Stelle.',
    '- {"typ":"pfeil","x1":..,"y1":..,"x2":..,"y2":..,"label":"optional"} ein Pfeil von einem Punkt zum anderen.',
    '- {"typ":"linie","x1":..,"y1":..,"x2":..,"y2":..} eine Verbindung ohne Spitze.',
    '- {"typ":"strich","punkte":[x0,y0,x1,y1,...]} ein freier Stift-Strich fuer Formen, die kein Sinnbild sind.',
    '- {"typ":"fertig"} als allerletzte Zeile.',
    "",
    `Die Tafel ist etwa ${CANVAS_BREITE} breit und 600 hoch. x laeuft nach rechts, y nach unten (0,0 ist oben links).`,
    "Platziere die Bilder mit Abstand und verteile sie sinnvoll ueber die Flaeche: auch oben, unten und nebeneinander, nicht alles in einer Reihe. Richtwert fuer groesse: 90 bis 240.",
    "",
    "Nur diese Sinnbilder sind erlaubt (Feld symbol):",
    SYMBOL_NAMEN.join(", ") + ".",
    "Brauchst du etwas, das nicht dabei ist, setze es aus mehreren Sinnbildern, Linien und freien Strichen zusammen oder beschrifte eine einfache Form.",
    "",
    "So arbeitest du:",
    "- Wechsle ab: erst ein kurzer Satz (sagen), dann ein bis zwei Zeichen-Schritte, dann der naechste Satz. Nicht erst alles erklaeren und dann alles malen.",
    "- Verbinde zusammengehoerende Bilder mit Pfeilen und beschrifte die wichtigen.",
    "- Halte das Bild klein und klar: Richtwert hoechstens 10 Sinnbilder. Lieber verstaendlich als vollstaendig.",
    "- Nutze nur das Wissen und das Material des Nutzers. Erfinde keine Zahlen, Namen oder Fakten (KI-ALL-11).",
    "",
    MATERIAL_REGEL,
    "",
    "Beispiel fuer das Format (nur das Format, nicht den Inhalt uebernehmen):",
    BEISPIEL,
  ].join("\n");
}

/**
 * Baut System- und Nutzertext. `frage` ist die Bitte des Nutzers, `kontext` das
 * optionale Material (z. B. die ausgewaehlte Notiz), das zwischen <quelle>-Marker
 * kommt.
 */
export function whiteboardPromptBauen(frage: string, kontext?: string): { system: string; nutzer: string } {
  const teile = [`Erklaere und male dazu: ${frage.trim()}`];
  const material = kontext?.trim();
  if (material) {
    const { text } = kuerzen(material, MAX_KONTEXT_ZEICHEN);
    teile.push("Stuetze dich auf dieses Material:", einbetten(text, "quelle"));
  }
  return { system: whiteboardSystemPrompt(), nutzer: teile.join("\n\n") };
}
