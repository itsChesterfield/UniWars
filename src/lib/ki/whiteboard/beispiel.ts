/**
 * KI-16.5: Fest verdrahtete Beispiel-Ereignisse fuer den Aufbau ohne KI und als
 * Mock-Stream. Ein kleines Tafelbild zur Fotosynthese: Sinnbilder frei platziert
 * (Sonne oben links, Wolke oben rechts, Baum in der Mitte, Wasser unten), dazu
 * Pfeile und Beschriftungen, verschraenkt mit Erklaertext (`sagen`).
 */
import type { WbEreignis } from "./protokoll.ts";

export const BEISPIEL_EREIGNISSE: WbEreignis[] = [
  { typ: "titel", text: "Fotosynthese" },
  { typ: "sagen", text: "Ein Baum macht sich seine Nahrung selbst, aus Licht, Wasser und Luft." },
  { typ: "bild", symbol: "sonne", x: 150, y: 140, groesse: 130 },
  { typ: "sagen", text: "Die Sonne liefert die Energie." },
  { typ: "bild", symbol: "baum", x: 500, y: 330, groesse: 240 },
  { typ: "pfeil", x1: 220, y1: 180, x2: 410, y2: 290, label: "Licht" },
  { typ: "sagen", text: "Aus der Luft nimmt der Baum Kohlendioxid auf." },
  { typ: "bild", symbol: "wolke", x: 840, y: 150, groesse: 170 },
  { typ: "pfeil", x1: 770, y1: 190, x2: 600, y2: 300, label: "CO2" },
  { typ: "sagen", text: "Aus dem Boden zieht er Wasser." },
  { typ: "bild", symbol: "wasser", x: 500, y: 560, groesse: 80 },
  { typ: "pfeil", x1: 500, y1: 520, x2: 500, y2: 450, label: "Wasser" },
  { typ: "sagen", text: "Daraus entstehen Zucker und Sauerstoff." },
  { typ: "pfeil", x1: 615, y1: 320, x2: 760, y2: 320 },
  { typ: "text", text: "Zucker + O2", x: 850, y: 320, groesse: 26 },
  { typ: "fertig" },
];

/** Dieselben Ereignisse als NDJSON-Text (eine Zeile pro Ereignis). */
export const BEISPIEL_NDJSON: string = BEISPIEL_EREIGNISSE.map((e) => JSON.stringify(e)).join("\n");
