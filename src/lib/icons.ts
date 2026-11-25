/**
 * Design B3: eigener Icon-Satz (Entscheidung Didi, 17.11.). Ersetzt Emojis als Icons (DESIGN.md Abschnitt 9).
 * Alle Symbole auf 24 × 24, Strich 1,7, runde Enden, ohne Füllung, wie die Symbolleiste.
 * Kurzschreibweise wie in `nav-icon.tsx`: Teile mit "|" getrennt, "rect:x,y,b,h,r", "circle:x,y,r", sonst Pfad.
 * Daten und Texte speichern nur den Namen (`IconName`), nie das Zeichen. Reine Daten ohne React, damit Tests sie prüfen.
 */
export const ICONS = {
  // Bereiche der Symbolleiste
  hub: "M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6",
  dateiablage: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  notizen: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M9 13h6M9 16.5h4",
  karteikarten: "rect:4,6,13,14,2|M8 3h9a2 2 0 0 1 2 2v11",
  pdf: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M8.5 15.5h2v3M13 13.5h2v5M8.5 12.5h1.5",
  lernraum: "M4 19.5V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2Z|M8 4v8l2.5-1.5L13 12V4|M17.5 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z",
  fokus: "circle:12,13,7|M12 13V9.5M9.5 3.5h5M12 3.5V6",
  mindmap: "circle:6,6,2.5|circle:18,7,2.5|circle:10,18,2.5|M8 7.5 15.5 8M8 16 9 9.5",
  whiteboard: "rect:3,4,18,14,2|m8 21 4-3 4 3|M7 9h6M7 13h9",
  literatur: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5Z|M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5Z",
  text: "M5 7V5h14v2M12 5v14M9.5 19h5",
  praesentation: "rect:3,4,18,12,2|M12 16v3M8.5 21h7",
  tabelle: "rect:3.5,4.5,17,15,2|M3.5 9.5h17M9 9.5v10M3.5 14.5h17",
  mikrofon: "rect:9,3,6,11,3|M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  chat: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-5 4Z",
  studio: "M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8Z|M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z",
  einstellungen: "circle:12,12,3|M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",

  // Unterseiten des Zentralen Hubs
  termine: "rect:3.5,5,17,15.5,2|M3.5 10h17|M8 3v4M16 3v4",
  aufgaben: "rect:4,4,16,16,3|m8.5 12 2.5 2.5 4.5-5",
  noten: "circle:12,9,5.5|M8.6 13.4 7 21l5-2.5 5 2.5-1.6-7.6",
  fortschritt: "M4 20h16|m5.5 15.5 4.5-5 3.5 3L19 7|M15 7h4v4",
  faecher: "rect:4,4,4,16,1|rect:10,4,4,16,1|m15.5 5.6 2.9-.8 3.7 14-2.9.8Z",

  // Aktionen
  suchen: "circle:11,11,6.5|m20 20-4.2-4.2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  hoch: "m6 15 6-6 6 6",
  runter: "m6 9 6 6 6-6",
  schliessen: "M6 6l12 12M18 6 6 18",
  haken: "m5 12.5 4.5 4.5L19 7.5",
  "pfeil-links": "M19 12H5|m11 6-6 6 6 6",
  "pfeil-rechts": "M5 12h14|m13 6 6 6-6 6",
  extern: "M14 4h6v6|M20 4l-9 9|M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  loeschen: "M4 7h16|M9.5 7V4.5h5V7|M6.5 7l1 13h9l1-13|M10 11v5.5M14 11v5.5",
  stift: "M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z|M13.5 7l3 3",
  markieren: "M14.5 4.5l5 5-8 8H6.5v-5Z|M4 21h16",
  rueckgaengig: "M9 14 4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  wiederholen: "m15 14 5-5-5-5|M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  "neu-laden": "M20 11a8 8 0 1 0-2.3 5.7|M20 4.5V11h-6.5",
  herunterladen: "M12 4v11|m7 10.5 5 5 5-5|M5 20h14",
  hochladen: "M12 15.5V4|m7 9 5-5 5 5|M5 20h14",
  tauschen: "M7 4 3.5 7.5 7 11|M3.5 7.5h14|m17 13 3.5 3.5L17 20|M20.5 16.5h-14",
  menue: "M4 7h16M4 12h16M4 17h16",
  aufzaehlung: "M9 6h11|M9 12h11|M9 18h11|M4.5 6h.01|M4.5 12h.01|M4.5 18h.01",
  nummerierung: "M10 6h10|M10 12h10|M10 18h10|M4 5h1v4|M4 9h2|M6 18H4l2-2.5a1 1 0 0 0-2-.8",
  mehr: "circle:5.5,12,1|circle:12,12,1|circle:18.5,12,1",
  kopieren: "rect:8,8,12,12,2|M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3",
  // seit Studio (18.11.): Senden, Leiste größer und kleiner
  senden: "M12 19V5|m6 11 6-6 6 6",
  vergroessern: "M14 4h6v6|M10 20H4v-6|M20 4l-6.5 6.5|M4 20l6.5-6.5",
  verkleinern: "M20 4l-6 6|M14 5v5h5|M4 20l6-6|M10 19v-5H5",
  schere: "circle:6,6,2.5|circle:6,18,2.5|M8 7.5 20 17M8 16.5 20 7",

  // Dinge
  anhang: "M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  uhr: "circle:12,12,8.5|M12 7.5V12l3 2",
  lesezeichen: "M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z",
  anheften: "M9 3.5h6l-1 5.5 4 4H6l4-4Z|M12 13v8",
  textmarker: "m14.5 4.5 5 5-8 8H6.5v-5Z|M4 20.5h8",
  bild: "rect:3.5,4.5,17,15,2|circle:9,10,1.8|m20.5 16-5-5L6 19.5",
  kamera: "M4 8a1.5 1.5 0 0 1 1.5-1.5h2.5L9.5 4h5L16 6.5h2.5A1.5 1.5 0 0 1 20 8v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z|circle:12,12.5,3.5",
  lautsprecher: "M4 9.5h3.5L12 5.5v13l-4.5-4H4Z|M15.5 9a4 4 0 0 1 0 6|M18 6.5a7.5 7.5 0 0 1 0 11",
  kopfhoerer: "M4 16v-3a8 8 0 0 1 16 0v3|rect:4,14,4,6,1.5|rect:16,14,4,6,1.5",
  zitat: "M10 7H6.5A1.5 1.5 0 0 0 5 8.5V12h5Z|M10 12v1.5A4.5 4.5 0 0 1 5.5 18|M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12h5Z|M19 12v1.5a4.5 4.5 0 0 1-4.5 4.5",
  globus: "circle:12,12,8.5|M3.5 12h17|M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5s-1.2 6.2-3.5 8.5c-2.3-2.3-3.5-5.2-3.5-8.5S9.7 5.8 12 3.5Z",
  gruppe: "circle:9,8,3.5|M2.5 20a6.5 6.5 0 0 1 13 0|M15.5 4.6a3.5 3.5 0 0 1 0 6.8|M18 14.2a6.5 6.5 0 0 1 3.5 5.8",
  auge: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z|circle:12,12,3",
  privat: "M3 3l18 18|M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.7 3.4|M6.6 7.1C4 8.7 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.1-1|M9.9 9.9a3 3 0 0 0 4.2 4.2",
  serie: "M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.5-5.4 3.6-8.3.4 1.6 1.4 2.8 2.6 3.3.2-2.6 1.4-5 3.3-6.8-.2 3 1.2 4.4 2.3 6.1.8 1.3 1.2 2.6 1.2 4 0 4.6-2.8 7.9-6.5 7.9Z",
  ziel: "circle:12,12,8.5|circle:12,12,4.5|circle:12,12,.8",
  schloss: "rect:5,11,14,9,2|M8 11V8a4 4 0 0 1 8 0v3",
  tipp: "M9 18h6M10 21h4|M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z",

  // Idee oder Fehler melden (Flagge je Bereich)
  flagge: "M6.5 21V4|M6.5 4.5h12l-3 3.25 3 3.25h-12Z",

  // Zustände
  warnung: "M12 3.5 21.5 20h-19Z|M12 10v4.5M12 17.2v.3",
  info: "circle:12,12,8.5|M12 11v5.5M12 7.8v.3",
  frage: "circle:12,12,8.5|M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4|M12 17v.3",

  // Wiedergabe
  abspielen: "M7 4.5v15l12-7.5Z",
  pause: "M8 5v14M16 5v14",
  stopp: "rect:6,6,12,12,2",
  vor: "M6 5l9 7-9 7Z|M18 5v14",
  zurueck: "M18 5l-9 7 9 7Z|M6 5v14",
} as const;

export type IconName = keyof typeof ICONS;

export const istIconName = (wert: unknown): wert is IconName =>
  typeof wert === "string" && Object.prototype.hasOwnProperty.call(ICONS, wert);

/** Einzelteile eines Symbols, für die Darstellung als SVG. */
export type SymbolTeil =
  | { art: "rect"; x: number; y: number; b: number; h: number; r: number }
  | { art: "circle"; x: number; y: number; r: number }
  | { art: "pfad"; d: string };

export function symbolTeile(kurz: string): SymbolTeil[] {
  return kurz.split("|").map((teil): SymbolTeil => {
    if (teil.startsWith("rect:")) {
      const [x, y, b, h, r] = teil.slice(5).split(",").map(Number);
      return { art: "rect", x, y, b, h, r: r ?? 0 };
    }
    if (teil.startsWith("circle:")) {
      const [x, y, r] = teil.slice(7).split(",").map(Number);
      return { art: "circle", x, y, r };
    }
    return { art: "pfad", d: teil };
  });
}
