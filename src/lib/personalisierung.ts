/**
 * Design B3, Personalisierung (DESIGN.md Abschnitt 6): Symbolleiste und persönliche Darstellung.
 * Reine Logik ohne React, damit sie in Server Actions, im Browser und in Tests gleich gilt.
 *
 * Gespeichert in `settings`:
 * - `symbolleiste`: {"reihe": ["hub", "work-station", …], "aus": ["mindmap"]}
 * - `darstellung`: {"schrift": "normal", "dichte": "normal", "bewegung": "system", "leiste": "hover", "design_schalter": false}
 * Das Design selbst steht in `settings.theme` (HELL, DUNKEL, SYSTEM).
 */

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------

export type Theme = "HELL" | "DUNKEL" | "SYSTEM";
/** Wert für `data-theme`. „system“ löst CSS über `prefers-color-scheme` auf, ohne Skript und ohne Aufblitzen. */
export type DesignAttribut = "hochschule" | "nacht" | "system";

export const THEMES: Theme[] = ["DUNKEL", "HELL", "SYSTEM"];
export const istTheme = (t: unknown): t is Theme => typeof t === "string" && (THEMES as string[]).includes(t);

export const DESIGN_NAMEN: Record<Theme, string> = {
  DUNKEL: "Sternenhimmel",
  HELL: "Hochschule",
  SYSTEM: "Wie das System",
};

export function designAttribut(theme: Theme | null | undefined): DesignAttribut {
  if (theme === "DUNKEL") return "nacht";
  if (theme === "SYSTEM") return "system";
  return "hochschule";
}

/** Das Design, das gerade zu sehen ist. „Wie das System“ folgt dem Gerät. */
export function sichtbaresDesign(theme: Theme | null | undefined, systemDunkel: boolean): "HELL" | "DUNKEL" {
  if (theme === "SYSTEM") return systemDunkel ? "DUNKEL" : "HELL";
  return theme === "DUNKEL" ? "DUNKEL" : "HELL";
}

// ---------------------------------------------------------------------------
// Darstellung (nur persönlich, wird von geteilten Designs nie überschrieben)
// ---------------------------------------------------------------------------

export type Darstellung = {
  schrift: "normal" | "gross";
  dichte: "normal" | "kompakt";
  bewegung: "system" | "reduziert";
  /** Seitenleiste: beim Drüberfahren ausklappen, immer ausgeklappt oder immer schmal */
  leiste: "hover" | "offen" | "zu";
  /** Design-Schalter in der Kopfleiste (Standard aus) */
  design_schalter: boolean;
};

export const STANDARD_DARSTELLUNG: Darstellung = { schrift: "normal", dichte: "normal", bewegung: "system", leiste: "hover", design_schalter: false };

const WERTE = {
  schrift: ["normal", "gross"],
  dichte: ["normal", "kompakt"],
  bewegung: ["system", "reduziert"],
  leiste: ["hover", "offen", "zu"],
} as const;

/** Liest den gespeicherten Wert. Unbekannte Schlüssel fallen weg, unbekannte Werte werden zum Standard. */
export function darstellungLesen(roh: unknown): Darstellung {
  const o = roh && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
  const wahl = <K extends keyof typeof WERTE>(k: K): Darstellung[K] =>
    ((WERTE[k] as readonly string[]).includes(o[k] as string) ? o[k] : STANDARD_DARSTELLUNG[k]) as Darstellung[K];
  return {
    schrift: wahl("schrift"),
    dichte: wahl("dichte"),
    // „ruhig“ hieß es im Dummy
    bewegung: o.bewegung === "ruhig" ? "reduziert" : wahl("bewegung"),
    leiste: wahl("leiste"),
    design_schalter: o.design_schalter === true,
  };
}

// ---------------------------------------------------------------------------
// Symbolleiste
// ---------------------------------------------------------------------------

/** Gruppen der Symbolleiste (DESIGN.md Abschnitt 4). Die Kennung ist der Pfad ohne Schrägstrich, der Hub heißt „hub“. */
export const SYMBOLLEISTE_GRUPPEN: { name: string; ids: string[] }[] = [
  { name: "Täglich", ids: ["hub", "work-station", "karteikarten", "notizen"] },
  { name: "Studium", ids: ["pdf-reader", "lernraum", "dateiablage", "literaturverwaltung", "transkription", "chat"] },
  { name: "Werkzeuge", ids: ["textverarbeitung", "tabellen", "praesentationen", "mindmap", "whiteboard"] },
];

/** Immer sichtbar: Über den Hub kommt man überall hin. */
export const FESTE_BEREICHE = ["hub"];

export const ALLE_BEREICHE = SYMBOLLEISTE_GRUPPEN.flatMap((g) => g.ids);
export const bereichHref = (id: string) => (id === "hub" ? "/" : `/${id}`);
export const bereichId = (href: string) => (href === "/" ? "hub" : href.replace(/^\//, ""));
export const gruppeVon = (id: string) => SYMBOLLEISTE_GRUPPEN.find((g) => g.ids.includes(id))?.name ?? null;

export type Symbolleiste = {
  /** alle Bereiche, Gruppe für Gruppe in der gewählten Reihenfolge */
  reihe: string[];
  /** ausgeblendete Bereiche, über die Suche weiter erreichbar */
  aus: string[];
};

export const standardSymbolleiste = (): Symbolleiste => ({ reihe: [...ALLE_BEREICHE], aus: [] });

/**
 * Liest den gespeicherten Wert. Die Gruppen bleiben fest: Innerhalb einer Gruppe gilt die gespeicherte Reihenfolge,
 * Unbekanntes und Doppeltes fällt weg, später hinzugekommene Bereiche hängen sichtbar am Ende ihrer Gruppe.
 * Feste Bereiche lassen sich nicht ausblenden.
 */
export function symbolleisteLesen(roh: unknown): Symbolleiste {
  const o = roh && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
  const gespeichert = Array.isArray(o.reihe) ? o.reihe.filter((x): x is string => typeof x === "string") : [];
  const reihe = SYMBOLLEISTE_GRUPPEN.flatMap((g) => {
    const bekannt = [...new Set(gespeichert.filter((id) => g.ids.includes(id)))];
    return [...bekannt, ...g.ids.filter((id) => !bekannt.includes(id))];
  });
  const aus = Array.isArray(o.aus)
    ? [...new Set(o.aus.filter((x): x is string => typeof x === "string" && ALLE_BEREICHE.includes(x) && !FESTE_BEREICHE.includes(x)))]
    : [];
  return { reihe, aus };
}

export const gleicheSymbolleiste = (a: Symbolleiste, b: Symbolleiste) =>
  a.reihe.join() === b.reihe.join() && [...a.aus].sort().join() === [...b.aus].sort().join();

/** Gruppen in der gewählten Reihenfolge, mit Sichtbarkeit. */
export function symbolleistenGruppen(s: Symbolleiste): { name: string; eintraege: { id: string; sichtbar: boolean; fest: boolean }[] }[] {
  return SYMBOLLEISTE_GRUPPEN.map((g) => ({
    name: g.name,
    eintraege: s.reihe
      .filter((id) => g.ids.includes(id))
      .map((id) => ({ id, sichtbar: !s.aus.includes(id), fest: FESTE_BEREICHE.includes(id) })),
  }));
}

/** Sichtbare Bereiche in der Reihenfolge der Symbolleiste. */
export const sichtbareBereiche = (s: Symbolleiste) => s.reihe.filter((id) => !s.aus.includes(id));

/** Handy: die ersten vier sichtbaren Bereiche stehen in der Tab-Leiste, der fünfte Platz öffnet die Suche. */
export const tabLeiste = (s: Symbolleiste) => sichtbareBereiche(s).slice(0, 4);

/** Tauscht einen Bereich mit seinem Nachbarn in derselben Gruppe. `null`, wenn es dort keinen gibt. */
export function bereichVerschieben(s: Symbolleiste, id: string, richtung: -1 | 1): Symbolleiste | null {
  const i = s.reihe.indexOf(id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= s.reihe.length || gruppeVon(s.reihe[j]) !== gruppeVon(id)) return null;
  const reihe = [...s.reihe];
  [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
  return { reihe, aus: [...s.aus] };
}

/** Setzt einen Bereich auf den Platz eines anderen derselben Gruppe (Ziehen und Ablegen). */
export function bereichUmsetzen(s: Symbolleiste, id: string, aufId: string): Symbolleiste {
  const von = s.reihe.indexOf(id);
  const nach = s.reihe.indexOf(aufId);
  if (von < 0 || nach < 0 || von === nach || gruppeVon(id) !== gruppeVon(aufId)) return s;
  const reihe = [...s.reihe];
  reihe.splice(von, 1);
  reihe.splice(nach, 0, id);
  return { reihe, aus: [...s.aus] };
}

export function bereichZeigen(s: Symbolleiste, id: string, sichtbar: boolean): Symbolleiste {
  if (FESTE_BEREICHE.includes(id) || !ALLE_BEREICHE.includes(id)) return s;
  const aus = s.aus.filter((x) => x !== id);
  return { reihe: [...s.reihe], aus: sichtbar ? aus : [...aus, id] };
}
