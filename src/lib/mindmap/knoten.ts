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
