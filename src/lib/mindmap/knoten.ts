// MindMap (MM-01 … MM-07): Knoten-Logik ohne React.

export type Knoten = { id: string; text: string; x: number; y: number; farbe: string; parent_id: string | null };
export type MindmapDaten = { knoten: Knoten[] };

// MM-03: 6 feste Farben
export const KNOTEN_FARBEN = [
  { name: "Gold", wert: "#d9a441" },
  { name: "Blau", wert: "#7c9fd8" },
  { name: "Grün", wert: "#6fae7c" },
  { name: "Rot", wert: "#e0654a" },
  { name: "Lila", wert: "#a689d0" },
  { name: "Grau", wert: "#ab9d82" },
] as const;

export const ABSTAND_X = 220;
export const ABSTAND_Y = 70;
export const MAX_KNOTEN = 1000;

function neueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/** MM-01: Startknoten mit dem Namen der Map in der Mitte. */
export function startDaten(name: string): MindmapDaten {
  return { knoten: [{ id: neueId(), text: name, x: 0, y: 0, farbe: KNOTEN_FARBEN[0].wert, parent_id: null }] };
}

export function wurzel(daten: MindmapDaten): Knoten | undefined {
  return daten.knoten.find((k) => k.parent_id === null);
}

export function datenLesen(roh: unknown, name: string): MindmapDaten {
  const liste = (roh && typeof roh === "object" && Array.isArray((roh as MindmapDaten).knoten) ? (roh as MindmapDaten).knoten : []) as unknown[];
  const knoten: Knoten[] = [];
  for (const k of liste.slice(0, MAX_KNOTEN)) {
    if (!k || typeof k !== "object") continue;
    const o = k as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    knoten.push({
      id: o.id.slice(0, 64),
      text: typeof o.text === "string" ? o.text.slice(0, 200) : "",
      x: Number.isFinite(o.x) ? Number(o.x) : 0,
      y: Number.isFinite(o.y) ? Number(o.y) : 0,
      farbe: typeof o.farbe === "string" && /^#[0-9a-f]{6}$/i.test(o.farbe) ? o.farbe : KNOTEN_FARBEN[0].wert,
      parent_id: typeof o.parent_id === "string" ? o.parent_id : null,
    });
  }
  // Genau eine Wurzel; verwaiste Knoten hängen an die Wurzel
  const ids = new Set(knoten.map((k) => k.id));
  let root = knoten.find((k) => k.parent_id === null);
  if (!root) return startDaten(name);
  for (const k of knoten) {
    if (k !== root && (k.parent_id === null || !ids.has(k.parent_id) || k.parent_id === k.id)) k.parent_id = root.id;
  }
  root = { ...root };
  return { knoten };
}

export function kinder(daten: MindmapDaten, id: string): Knoten[] {
  return daten.knoten.filter((k) => k.parent_id === id);
}

/** Alle Nachkommen (ohne den Knoten selbst). */
export function nachkommen(daten: MindmapDaten, id: string): Set<string> {
  const ergebnis = new Set<string>();
  const stapel = [id];
  while (stapel.length) {
    const aktuell = stapel.pop() as string;
    for (const k of daten.knoten) {
      if (k.parent_id === aktuell && !ergebnis.has(k.id)) {
        ergebnis.add(k.id);
        stapel.push(k.id);
      }
    }
  }
  return ergebnis;
}

/** MM-02 (Tab): neuer Kindknoten rechts neben dem Eltern-Knoten, unter den Geschwistern. */
export function kindHinzufuegen(daten: MindmapDaten, parentId: string): { daten: MindmapDaten; neu: Knoten } | null {
  const eltern = daten.knoten.find((k) => k.id === parentId);
  if (!eltern || daten.knoten.length >= MAX_KNOTEN) return null;
  const geschwister = kinder(daten, parentId);
  const opa = eltern.parent_id ? daten.knoten.find((k) => k.id === eltern.parent_id) : undefined;
  // Richtung: von der Wurzel weg (links/rechts)
  const richtung = opa && eltern.x < opa.x ? -1 : 1;
  const y = geschwister.length ? Math.max(...geschwister.map((g) => g.y)) + ABSTAND_Y : eltern.y;
  const neu: Knoten = { id: neueId(), text: "", x: eltern.x + richtung * ABSTAND_X, y, farbe: eltern.farbe, parent_id: parentId };
  return { daten: { knoten: [...daten.knoten, neu] }, neu };
}

/** MM-02 (Enter): Geschwisterknoten. Am Startknoten gibt es keine Geschwister -> Kind. */
export function geschwisterHinzufuegen(daten: MindmapDaten, id: string): { daten: MindmapDaten; neu: Knoten } | null {
  const k = daten.knoten.find((x) => x.id === id);
  if (!k) return null;
  return kindHinzufuegen(daten, k.parent_id ?? k.id);
}

/** MM-04: Knoten samt Unterbaum verschieben. */
export function verschieben(daten: MindmapDaten, id: string, dx: number, dy: number): MindmapDaten {
  const betroffen = nachkommen(daten, id);
  betroffen.add(id);
  return { knoten: daten.knoten.map((k) => (betroffen.has(k.id) ? { ...k, x: k.x + dx, y: k.y + dy } : k)) };
}

/** MM-05: Knoten mit allen Kindern löschen; der Startknoten bleibt. */
export function loeschen(daten: MindmapDaten, id: string): MindmapDaten | null {
  const k = daten.knoten.find((x) => x.id === id);
  if (!k || k.parent_id === null) return null;
  const weg = nachkommen(daten, id);
  weg.add(id);
  return { knoten: daten.knoten.filter((x) => !weg.has(x.id)) };
}

export function aendern(daten: MindmapDaten, id: string, teil: Partial<Pick<Knoten, "text" | "farbe">>): MindmapDaten {
  return { knoten: daten.knoten.map((k) => (k.id === id ? { ...k, ...teil } : k)) };
}

// ---------------------------------------------------------------------------
// KI-07: Positionen für eine erzeugte Struktur berechnen (radial um die Wurzel)
// ---------------------------------------------------------------------------

export type BaumKnoten = { text: string; kinder: BaumKnoten[] };

/** Geschätzte Knotengröße wie im Editor (Breite 90–360 px, Wurzel größer). */
export function knotenGroesse(text: string, istWurzel: boolean): { b: number; h: number } {
  const proZeichen = istWurzel ? 10.5 : 8.4;
  const b = Math.max(istWurzel ? 140 : 90, Math.min(360, Math.round(text.length * proZeichen + 32)));
  return { b, h: istWurzel ? 54 : 40 };
}

/** Mindestabstand zwischen zwei Knoten-Rechtecken */
export const LAYOUT_LUECKE = 16;

function ueberlappen(a: Knoten, b: Knoten, luecke = LAYOUT_LUECKE): boolean {
  const ga = knotenGroesse(a.text, a.parent_id === null);
  const gb = knotenGroesse(b.text, b.parent_id === null);
  return Math.abs(a.x - b.x) < (ga.b + gb.b) / 2 + luecke && Math.abs(a.y - b.y) < (ga.h + gb.h) / 2 + luecke;
}

/** Prüft, ob sich irgendwelche Knoten überlappen (für Tests und als Sicherheitsnetz). */
export function hatUeberlappung(daten: MindmapDaten, luecke = LAYOUT_LUECKE): boolean {
  const k = daten.knoten;
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (ueberlappen(k[i], k[j], luecke)) return true;
  return false;
}

/**
 * Legt eine MindMap aus einem Baum an: Wurzel in der Mitte, Hauptäste im Kreis,
 * jeder Ast bekommt einen Winkelbereich passend zu seiner Größe. Danach werden
 * überlappende Knoten entlang ihres Strahls nach außen geschoben.
 */
export function radialLayout(wurzelText: string, baum: BaumKnoten[], id: () => string = neueId): MindmapDaten {
  const wurzelKnoten: Knoten = { id: id(), text: wurzelText, x: 0, y: 0, farbe: KNOTEN_FARBEN[0].wert, parent_id: null };
  const knoten: Knoten[] = [wurzelKnoten];
  const winkel = new Map<string, number>();
  const ebene = new Map<string, number>([[wurzelKnoten.id, 0]]);
  const blaetter = (k: BaumKnoten): number => Math.max(1, k.kinder.reduce((n, c) => n + blaetter(c), 0));
  const RADIUS = [0, 280, 520, 760];

  function platzieren(liste: BaumKnoten[], parent: Knoten, von: number, bis: number, stufe: number, farbe: string | null) {
    const gesamt = liste.reduce((n, k) => n + blaetter(k), 0) || 1;
    let start = von;
    liste.forEach((k, i) => {
      const anteil = ((bis - von) * blaetter(k)) / gesamt;
      const w = start + anteil / 2;
      // Hauptäste bekommen eigene Farben, Unteräste erben sie
      const astFarbe = farbe ?? KNOTEN_FARBEN[1 + (i % (KNOTEN_FARBEN.length - 1))].wert;
      const r = RADIUS[Math.min(stufe, RADIUS.length - 1)] + (stufe >= RADIUS.length ? (stufe - RADIUS.length + 1) * 240 : 0);
      const neu: Knoten = { id: id(), text: k.text, x: Math.cos(w) * r, y: Math.sin(w) * r, farbe: astFarbe, parent_id: parent.id };
      knoten.push(neu);
      winkel.set(neu.id, w);
      ebene.set(neu.id, stufe);
      platzieren(k.kinder, neu, start, start + anteil, stufe + 1, astFarbe);
      start += anteil;
    });
  }
  // Start oben (−90°), im Uhrzeigersinn
  platzieren(baum, wurzelKnoten, -Math.PI / 2, (3 * Math.PI) / 2, 1, null);

  // Überlappungen auflösen: den äußeren Knoten (höhere Ebene) nach außen schieben
  for (let runde = 0; runde < 400; runde++) {
    let verschoben = false;
    for (let i = 0; i < knoten.length; i++) {
      for (let j = i + 1; j < knoten.length; j++) {
        if (!ueberlappen(knoten[i], knoten[j])) continue;
        const [a, b] = [knoten[i], knoten[j]];
        const aussen = (ebene.get(b.id) ?? 0) >= (ebene.get(a.id) ?? 0) ? b : a;
        const w = winkel.get(aussen.id);
        if (w === undefined) continue; // Wurzel bleibt in der Mitte
        aussen.x += Math.cos(w) * 24;
        aussen.y += Math.sin(w) * 24;
        verschoben = true;
      }
    }
    if (!verschoben) break;
  }

  for (const k of knoten) {
    k.x = Math.round(k.x);
    k.y = Math.round(k.y);
  }
  return { knoten };
}
