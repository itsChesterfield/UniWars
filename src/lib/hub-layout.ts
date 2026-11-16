/**
 * Design B3, Zentraler Hub (DESIGN.md Abschnitt 5): Übersicht auf einem Raster mit drei Spalten.
 * Bausteine gibt es in festen Stufen statt freiem Skalieren: S = ein Drittel, M = zwei Drittel, L = volle Breite.
 * Gespeichert wird in `settings.hub_layout` als Liste `[id, sichtbar, Größe]`.
 */
/** Ereignis: Bearbeiten-Modus des Hubs starten (Kopfleiste, später Befehlspalette und Einstellungen). */
export const HUB_ANORDNEN = "uniwars-hub-anordnen";

export type BausteinId = "naechstes" | "fakten" | "heute" | "vorschlag" | "woche" | "wiederholen";
export type Groesse = "S" | "M" | "L";
export type HubEintrag = [id: BausteinId, sichtbar: boolean, groesse: Groesse];
export type HubLayout = HubEintrag[];

export const BAUSTEIN_NAMEN: Record<BausteinId, string> = {
  naechstes: "Als Nächstes",
  fakten: "Überblick",
  heute: "Heute",
  vorschlag: "Dein Tag",
  woche: "Diese Woche",
  wiederholen: "Wiederholen",
};

/** Jeder Baustein erlaubt nur Größen, in denen sein Inhalt funktioniert. */
export const GROESSEN: Record<BausteinId, Groesse[]> = {
  naechstes: ["M", "L"],
  fakten: ["M", "L"],
  heute: ["M", "L"],
  vorschlag: ["S", "M", "L"],
  woche: ["M", "L"],
  wiederholen: ["S", "M"],
};

export const SPANNE: Record<Groesse, number> = { S: 1, M: 2, L: 3 };
export const GROESSEN_NAMEN: Record<Groesse, string> = { S: "schmal", M: "mittel", L: "breit" };

export type Voreinstellung = "ruhig" | "ausgewogen" | "alles";
export const VOREINSTELLUNG_NAMEN: Record<Voreinstellung, string> = { ruhig: "Ruhig", ausgewogen: "Ausgewogen", alles: "Alles" };

export const VOREINSTELLUNGEN: Record<Voreinstellung, HubLayout> = {
  ruhig: [
    ["naechstes", true, "L"],
    ["heute", true, "M"],
    ["vorschlag", true, "S"],
    ["fakten", false, "L"],
    ["woche", false, "L"],
    ["wiederholen", false, "S"],
  ],
  ausgewogen: [
    ["naechstes", true, "L"],
    ["fakten", true, "L"],
    ["heute", true, "M"],
    ["vorschlag", true, "S"],
    ["woche", true, "L"],
    ["wiederholen", false, "S"],
  ],
  alles: [
    ["naechstes", true, "L"],
    ["fakten", true, "M"],
    ["wiederholen", true, "S"],
    ["heute", true, "M"],
    ["vorschlag", true, "S"],
    ["woche", true, "L"],
  ],
};

export const kopie = (l: HubLayout): HubLayout => l.map((e) => [...e] as HubEintrag);
export const standardLayout = (): HubLayout => kopie(VOREINSTELLUNGEN.ausgewogen);

const istBaustein = (id: unknown): id is BausteinId => typeof id === "string" && id in BAUSTEIN_NAMEN;

/**
 * Liest den gespeicherten Wert. Unbekanntes fällt weg, Doppeltes zählt einmal,
 * eine unpassende Größe wird zur ersten erlaubten, und später hinzugekommene Bausteine hängen ausgeblendet hinten an.
 * Ist nichts Brauchbares gespeichert, gilt „Ausgewogen“.
 */
export function hubLayoutLesen(roh: unknown): HubLayout {
  if (!Array.isArray(roh)) return standardLayout();
  const layout: HubLayout = [];
  for (const e of roh) {
    if (!Array.isArray(e) || !istBaustein(e[0]) || layout.some(([id]) => id === e[0])) continue;
    const groesse = GROESSEN[e[0]].includes(e[2]) ? (e[2] as Groesse) : GROESSEN[e[0]][0];
    layout.push([e[0], e[1] === true || e[1] === 1, groesse]);
  }
  if (!layout.length) return standardLayout();
  for (const [id, , groesse] of VOREINSTELLUNGEN.ausgewogen) {
    if (!layout.some(([x]) => x === id)) layout.push([id, false, groesse]);
  }
  return layout;
}

export const gleich = (a: HubLayout, b: HubLayout) => JSON.stringify(a) === JSON.stringify(b);

export function voreinstellungVon(layout: HubLayout): Voreinstellung | null {
  const treffer = (Object.keys(VOREINSTELLUNGEN) as Voreinstellung[]).find((k) => gleich(VOREINSTELLUNGEN[k], layout));
  return treffer ?? null;
}

export const sichtbare = (layout: HubLayout): BausteinId[] => layout.filter(([, an]) => an).map(([id]) => id);

export type Platz = {
  id: BausteinId;
  groesse: Groesse;
  spalte: number;
  zeile: number;
  /** Spalten laut Größe */
  spanne: number;
  /** Spalten, die in der Zeile hinter dem Baustein frei bleiben; im Hub füllt er sie */
  frei: number;
};

/** Spalte und Zeile je sichtbarem Baustein, damit Trennlinien nur zwischen Bausteinen liegen. */
export function rasterPlan(layout: HubLayout): Platz[] {
  let spalte = 0;
  let zeile = 0;
  const plan: Platz[] = [];
  for (const [id, an, groesse] of layout) {
    if (!an) continue;
    const spanne = SPANNE[groesse];
    if (spalte + spanne > 3) {
      spalte = 0;
      zeile++;
    }
    plan.push({ id, groesse, spalte, zeile, spanne, frei: 0 });
    spalte += spanne;
    if (spalte >= 3) {
      spalte = 0;
      zeile++;
    }
  }
  plan.forEach((p, i) => {
    const danach = plan[i + 1];
    if (!danach || danach.zeile !== p.zeile) p.frei = 3 - p.spalte - p.spanne;
  });
  return plan;
}

/** Tauscht einen sichtbaren Baustein mit seinem sichtbaren Nachbarn. `null`, wenn es dort keinen gibt. */
export function verschieben(layout: HubLayout, id: BausteinId, richtung: -1 | 1): HubLayout | null {
  const an = sichtbare(layout);
  const ziel = an[an.indexOf(id) + richtung];
  if (!an.includes(id) || !ziel) return null;
  const neu = kopie(layout);
  const i = neu.findIndex(([x]) => x === id);
  const j = neu.findIndex(([x]) => x === ziel);
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

/** Setzt einen Baustein auf den Platz eines anderen (Ziehen und Ablegen). */
export function umsetzen(layout: HubLayout, id: BausteinId, aufId: BausteinId): HubLayout {
  const von = layout.findIndex(([x]) => x === id);
  const nach = layout.findIndex(([x]) => x === aufId);
  if (von < 0 || nach < 0 || von === nach) return layout;
  const neu = kopie(layout);
  const [e] = neu.splice(von, 1);
  neu.splice(nach, 0, e);
  return neu;
}

export function groesseSetzen(layout: HubLayout, id: BausteinId, groesse: Groesse): HubLayout {
  if (!GROESSEN[id].includes(groesse)) return layout;
  return layout.map((e) => (e[0] === id ? [e[0], e[1], groesse] : e));
}

export function sichtbarSetzen(layout: HubLayout, id: BausteinId, an: boolean): HubLayout {
  return layout.map((e) => (e[0] === id ? [e[0], an, e[2]] : e));
}
