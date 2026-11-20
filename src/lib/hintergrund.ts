/**
 * Eigene Bilder in der Personalisierung (Aufgabe 2, Grundlage `claude/universe-theme-baukasten-recherche.md`).
 * Reine Logik ohne React und ohne Server, damit sie im Browser, in Server Actions und in Tests gleich gilt.
 *
 * Gespeichert in `settings.hintergrund` (jsonb):
 * {
 *   "bilder": [{ "id", "pfad", "mittel", "weich", "tief", "hoch", "mitte", "abdunkeln", "unschaerfe" }],
 *   "standard": "<id>" | null,
 *   "flaechen": { "leiste": "standard" | "aus" | "<id>", "studio": …, "bereiche": … },
 *   "bereich": { "karteikarten": "standard" | "aus" | "<id>", … },
 *   "groesse": "kopf" | "gross" | "seite",
 *   "lernen_aus": true
 * }
 * Dieselben Bilder gelten in beiden Designs; der Schleier passt sich an (hell aufhellen, dunkel abdunkeln).
 */

import { ALLE_BEREICHE } from "./personalisierung.ts";

export const BUCKET = "hintergrund";
export const MAX_BILDER = 12;
/** Größe der Datei, die man auswählen darf. Hochgeladen wird danach nur die verkleinerte Fassung. */
export const MAX_EINGABE_BYTES = 20 * 1024 * 1024;
export const EINGABE_TYPEN = ["image/jpeg", "image/png", "image/webp"];
/** Längste Kante der Fassungen: groß für den Bildschirm, mittel fürs Handy, weich (vorberechnet unscharf) für Leiste und Studio */
export const KANTEN = { gross: 2560, mittel: 1280, weich: 640 } as const;

export type Mitte = "oben" | "mitte" | "unten";
export type Abdunkeln = 0 | 1 | 2;

export type Bild = {
  id: string;
  /** Pfade im Bucket, immer unter `<user_id>/` */
  pfad: string;
  mittel: string;
  weich: string;
  /** Helligkeit der dunklen und hellen Stellen (1. und 99. Perzentil, sRGB 0 bis 1), beim Hochladen gemessen */
  tief: number;
  hoch: number;
  mitte: Mitte;
  /** Zusätzlicher Schleier über dem Mindestwert: normal, mehr, viel */
  abdunkeln: Abdunkeln;
  unschaerfe: boolean;
};

export type Wahl = "standard" | "aus" | string;
export const FLAECHEN = ["leiste", "studio", "bereiche"] as const;
export type Flaeche = (typeof FLAECHEN)[number];
export type Groesse = "kopf" | "gross" | "seite";

export type Hintergrund = {
  bilder: Bild[];
  standard: string | null;
  flaechen: Record<Flaeche, Wahl>;
  /** Abweichungen einzelner Bereiche von `flaechen.bereiche` */
  bereich: Record<string, Wahl>;
  groesse: Groesse;
  /** Beim Lernen und in Editoren keine Bilder (Standard an) */
  lernen_aus: boolean;
};

export const FLAECHEN_NAMEN: Record<Flaeche, string> = {
  leiste: "Symbolleiste",
  studio: "Studio",
  bereiche: "Bereiche",
};

export const leererHintergrund = (): Hintergrund => ({
  bilder: [],
  standard: null,
  flaechen: { leiste: "standard", studio: "standard", bereiche: "standard" },
  bereich: {},
  groesse: "kopf",
  lernen_aus: true,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const zahl01 = (x: unknown, ersatz: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : ersatz);

/** Ein Pfad gehört dem Nutzer, wenn er in seinem Ordner liegt und nur erlaubte Zeichen hat. */
export function eigenerPfad(pfad: unknown, userId: string): pfad is string {
  return typeof pfad === "string" && pfad.length <= 200 && pfad.startsWith(`${userId}/`) && /^[0-9a-f-]+\/[0-9a-f-]+(-m|-w)?\.(webp|jpg)$/.test(pfad);
}

/** Liest ein Bild. Unbrauchbares ergibt `null`. Mit `userId` werden fremde Pfade abgewiesen. */
export function bildLesen(roh: unknown, userId?: string): Bild | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (typeof o.id !== "string" || !UUID.test(o.id)) return null;
  const pfade = [o.pfad, o.mittel, o.weich];
  if (!pfade.every((p) => typeof p === "string" && p.length > 0 && p.length <= 200)) return null;
  if (userId && !pfade.every((p) => eigenerPfad(p, userId))) return null;
  return {
    id: o.id,
    pfad: o.pfad as string,
    mittel: o.mittel as string,
    weich: o.weich as string,
    tief: zahl01(o.tief, 0),
    hoch: zahl01(o.hoch, 1),
    mitte: o.mitte === "oben" || o.mitte === "unten" ? o.mitte : "mitte",
    abdunkeln: o.abdunkeln === 1 || o.abdunkeln === 2 ? o.abdunkeln : 0,
    unschaerfe: o.unschaerfe === true,
  };
}

/** Liest den gespeicherten Wert. Fehlt die Spalte noch (Migration nicht eingespielt), kommt `null` herein: leer. */
export function hintergrundLesen(roh: unknown, userId?: string): Hintergrund {
  const leer = leererHintergrund();
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return leer;
  const o = roh as Record<string, unknown>;
  const gesehen = new Set<string>();
  const bilder = (Array.isArray(o.bilder) ? o.bilder : [])
    .map((b) => bildLesen(b, userId))
    .filter((b): b is Bild => b !== null && !gesehen.has(b.id) && Boolean(gesehen.add(b.id)))
    .slice(0, MAX_BILDER);
  const ids = new Set(bilder.map((b) => b.id));
  const wahl = (x: unknown): Wahl => (x === "aus" ? "aus" : typeof x === "string" && ids.has(x) ? x : "standard");
  const fl = o.flaechen && typeof o.flaechen === "object" && !Array.isArray(o.flaechen) ? (o.flaechen as Record<string, unknown>) : {};
  const be = o.bereich && typeof o.bereich === "object" && !Array.isArray(o.bereich) ? (o.bereich as Record<string, unknown>) : {};
  const bereich: Record<string, Wahl> = {};
  for (const id of ALLE_BEREICHE) {
    if (be[id] === undefined) continue;
    const w = wahl(be[id]);
    if (w !== "standard") bereich[id] = w;
  }
  return {
    bilder,
    standard: typeof o.standard === "string" && ids.has(o.standard) ? o.standard : (bilder[0]?.id ?? null),
    flaechen: { leiste: wahl(fl.leiste), studio: wahl(fl.studio), bereiche: wahl(fl.bereiche) },
    bereich,
    groesse: o.groesse === "gross" || o.groesse === "seite" ? o.groesse : "kopf",
    lernen_aus: o.lernen_aus !== false,
  };
}

/** Welches Bild eine Fläche zeigt. Ein einzelner Bereich folgt sonst der Wahl für alle Bereiche. */
export function bildFuer(h: Hintergrund, flaeche: Flaeche, bereichId?: string | null): Bild | null {
  let w: Wahl = flaeche === "bereiche" && bereichId && h.bereich[bereichId] ? h.bereich[bereichId] : h.flaechen[flaeche];
  if (w === "aus") return null;
  if (w === "standard") w = h.standard ?? "aus";
  return h.bilder.find((b) => b.id === w) ?? null;
}

/** Alle Bilder, die gerade irgendwo zu sehen sind (für signierte Links). */
export function benutzteBilder(h: Hintergrund): Bild[] {
  const ids = new Set<string>();
  for (const f of FLAECHEN) {
    const b = bildFuer(h, f);
    if (b) ids.add(b.id);
  }
  for (const id of Object.keys(h.bereich)) {
    const b = bildFuer(h, "bereiche", id);
    if (b) ids.add(b.id);
  }
  return h.bilder.filter((b) => ids.has(b.id));
}

/** Bild aus allen Zuordnungen nehmen (vor dem Löschen). Der Standard rückt auf das nächste Bild. */
export function bildEntfernen(h: Hintergrund, id: string): Hintergrund {
  const bilder = h.bilder.filter((b) => b.id !== id);
  const ersetzen = (w: Wahl): Wahl => (w === id ? "standard" : w);
  const bereich: Record<string, Wahl> = {};
  for (const [k, w] of Object.entries(h.bereich)) if (w !== id) bereich[k] = w;
  return {
    ...h,
    bilder,
    standard: h.standard === id ? (bilder[0]?.id ?? null) : h.standard,
    flaechen: { leiste: ersetzen(h.flaechen.leiste), studio: ersetzen(h.flaechen.studio), bereiche: ersetzen(h.flaechen.bereiche) },
    bereich,
  };
}

// ---------------------------------------------------------------------------
// Lesbarkeit: Mindest-Schleier aus der gemessenen Helligkeit
// ---------------------------------------------------------------------------

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const srgb = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
const hexHell = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => linear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Farben aus DESIGN.md: Der schwächste Text, der auf einem Bild stehen darf, ist `--text-2`.
 * Der Schleier hat die Farbe `--bild-schleier` (dunkel: Grund, hell: Fläche 2).
 */
export const SCHLEIER_FARBEN = {
  DUNKEL: { text: "#a8acb3", schleier: "#08090b" },
  HELL: { text: "#4f555e", schleier: "#f7f7f5" },
} as const;

/** Untergrenze, damit ein Bild nie ganz ungedämpft hinter der Oberfläche steht */
const MINDEST = { DUNKEL: 0.3, HELL: 0.25 } as const;
const STUFEN = [0, 0.15, 0.3] as const;

export const kontrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Deckkraft des Schleiers, damit `--text-2` auch auf der hellsten (dunkles Design) bzw. dunkelsten (helles Design)
 * Stelle des Bildes mindestens 4,5:1 erreicht. Der Schleier mischt im sRGB-Raum, wie der Browser.
 */
export function schleier(bild: Pick<Bild, "tief" | "hoch" | "abdunkeln">, design: "HELL" | "DUNKEL"): number {
  const f = SCHLEIER_FARBEN[design];
  const lt = hexHell(f.text);
  const s = srgb(hexHell(f.schleier));
  let a: number;
  if (design === "DUNKEL") {
    const ziel = srgb((lt + 0.05) / 4.5 - 0.05);
    const w = bild.hoch;
    a = w <= ziel ? 0 : (w - ziel) / (w - s);
  } else {
    const ziel = srgb(4.5 * (lt + 0.05) - 0.05);
    const w = bild.tief;
    a = w >= ziel ? 0 : (ziel - w) / (s - w);
  }
  a = Math.max(a, MINDEST[design]) + STUFEN[bild.abdunkeln];
  return Math.round(Math.min(0.95, a) * 1000) / 1000;
}

/** Helligkeit an einer Stelle nach dem Schleier (für Tests und die Vorschau). */
export function nachSchleier(wert: number, a: number, design: "HELL" | "DUNKEL"): number {
  const s = srgb(hexHell(SCHLEIER_FARBEN[design].schleier));
  return linear(a * s + (1 - a) * wert);
}
export const textHelligkeit = (design: "HELL" | "DUNKEL") => hexHell(SCHLEIER_FARBEN[design].text);

/**
 * Misst Perzentile der Helligkeit aus Bildpunkten (RGBA wie aus `getImageData`).
 * 1. und 99. Perzentil statt Minimum und Maximum: Einzelne Sterne zählen, einzelne Bildfehler nicht.
 */
export function helligkeitMessen(rgba: ArrayLike<number>): { tief: number; hoch: number } {
  const hist = new Array<number>(256).fill(0);
  let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 8) continue;
    // Luma im sRGB-Raum, gerundet auf 0 bis 255
    hist[Math.round(0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2])]++;
    n++;
  }
  if (!n) return { tief: 0, hoch: 1 };
  const perzentil = (p: number) => {
    const grenze = n * p;
    let summe = 0;
    for (let v = 0; v < 256; v++) {
      summe += hist[v];
      if (summe >= grenze) return v / 255;
    }
    return 1;
  };
  return { tief: perzentil(0.01), hoch: perzentil(0.99) };
}

/** CSS `background-position` für die gewählte Bildmitte */
export const POSITION: Record<Mitte, string> = { oben: "center top", mitte: "center", unten: "center bottom" };

/** Bereich zu einem Pfad: Unterseiten des Hubs zählen zum Hub, Einstellungen haben keinen Bereich. */
export function bereichZuPfad(pfad: string, hubUnterseiten: string[]): string | null {
  const sauber = pfad.split(/[?#]/)[0];
  if (sauber === "/" || hubUnterseiten.includes(sauber)) return "hub";
  const erstes = sauber.split("/")[1] ?? "";
  return ALLE_BEREICHE.includes(erstes) ? erstes : null;
}
