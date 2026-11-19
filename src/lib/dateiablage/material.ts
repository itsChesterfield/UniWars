import type { IconName } from "@/lib/icons";

export const MATERIAL_ARTEN = {
  notiz: { name: "Notiz", icon: "notizen", pfad: "/notizen?id=" },
  stapel: { name: "Karteikarten", icon: "karteikarten", pfad: "/karteikarten/" },
  praesentation: { name: "Präsentation", icon: "praesentation", pfad: "/praesentationen/" },
  whiteboard: { name: "Whiteboard", icon: "whiteboard", pfad: "/whiteboard/" },
  mindmap: { name: "Mindmap", icon: "mindmap", pfad: "/mindmap/" },
  dokument: { name: "Dokument", icon: "text", pfad: "/textverarbeitung/" },
  tabelle: { name: "Tabelle", icon: "tabelle", pfad: "/tabellen/" },
  transkript: { name: "Transkript", icon: "mikrofon", pfad: "/transkription/" },
  podcast: { name: "Podcast", icon: "kopfhoerer", pfad: "/transkription/podcast/" },
  quiz: { name: "Quiz", icon: "karteikarten", pfad: "/karteikarten/quiz/" },
  literatur: { name: "Literatur", icon: "literatur", pfad: "/literaturverwaltung?id=" },
} as const satisfies Record<string, { name: string; icon: IconName; pfad: string }>;

export type OriginalArt = "datei" | MaterialArt;
export type MaterialRef = { art: OriginalArt; id: string };

export type MaterialArt = keyof typeof MATERIAL_ARTEN;
export type HubMaterial = { art: MaterialArt; id: string; titel: string; fachId: string | null; userId: string; erstelltAm: string };

export function materialPfad(material: Pick<HubMaterial, "art" | "id">): string {
  return MATERIAL_ARTEN[material.art].pfad + encodeURIComponent(material.id);
}


export type MaterialFachZuordnung = { art: string; material_id: string; fach_id: string; ausgeblendet: boolean; thema_id?: string | null };

export function fachZuordnungen(fachId: string | null, aenderungen: MaterialFachZuordnung[]): string[] {
  const faecher = new Set(fachId ? [fachId] : []);
  for (const eintrag of aenderungen) {
    if (eintrag.ausgeblendet) faecher.delete(eintrag.fach_id);
    else faecher.add(eintrag.fach_id);
  }
  return [...faecher];
}


export function hubFachzuordnungen<T extends { id: string; fach_id: string | null }>(
  eintraege: T[],
  zuordnungen: MaterialFachZuordnung[],
): (T & { fach_ids: string[] })[] {
  const nachMaterial = new Map<string, MaterialFachZuordnung[]>();
  for (const zuordnung of zuordnungen) {
    const liste = nachMaterial.get(zuordnung.material_id) ?? [];
    liste.push(zuordnung);
    nachMaterial.set(zuordnung.material_id, liste);
  }
  return eintraege.map((e) => ({ ...e, fach_ids: fachZuordnungen(e.fach_id, nachMaterial.get(e.id) ?? []) }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function materialVomPfad(pfad: string, suche: URLSearchParams): string | null {
  const pdfId = pfad.startsWith("/pdf-reader/") ? pfad.slice("/pdf-reader/".length) : "";
  if (UUID.test(pdfId)) return `datei:${pdfId}`;
  const webLinkId = pfad.startsWith("/dateiablage/weblink/") ? pfad.slice("/dateiablage/weblink/".length) : "";
  if (UUID.test(webLinkId)) return `datei:${webLinkId}`;
  for (const [art, { pfad: route }] of Object.entries(MATERIAL_ARTEN)) {
    const query = route.endsWith("?id=");
    const id = query
      ? (pfad === route.slice(0, -4) ? suche.get("id") : null)
      : (pfad.startsWith(route) ? pfad.slice(route.length) : null);
    if (id && UUID.test(id)) return `${art}:${id}`;
  }
  const lernId = pfad.match(/^\/karteikarten\/([0-9a-f-]+)\/lernen$/i)?.[1];
  return lernId && UUID.test(lernId) ? `stapel:${lernId}` : null;
}


export function materialRef(wert: unknown): MaterialRef | null {
  if (!wert || typeof wert !== "object") return null;
  const { art, id } = wert as { art?: unknown; id?: unknown };
  if (typeof id !== "string" || !UUID.test(id) || typeof art !== "string") return null;
  return art === "datei" || Object.hasOwn(MATERIAL_ARTEN, art) ? { art: art as OriginalArt, id } : null;
}

export function materialRefs(werte: unknown, limit: number): MaterialRef[] {
  if (!Array.isArray(werte) || !werte.length || werte.length > limit) return [];
  const refs = werte.map(materialRef);
  if (refs.some((ref) => !ref)) return [];
  return [...new Map(refs.flatMap((ref) => ref ? [[`${ref.art}:${ref.id}`, ref] as const] : [])).values()];
}

export const istMaterialId = (wert: unknown): wert is string => typeof wert === "string" && UUID.test(wert);

export type MaterialZiel =
  | { art: "todo" | "deadline" | "pruefung"; id: string }
  | { art: "vorlesung"; id: string; datum: string };

export function materialZiel(wert: unknown): MaterialZiel | null {
  if (!wert || typeof wert !== "object") return null;
  const { art, id, datum } = wert as { art?: unknown; id?: unknown; datum?: unknown };
  if (!istMaterialId(id)) return null;
  if (art === "todo" || art === "deadline" || art === "pruefung") return { art, id };
  if (art !== "vorlesung" || typeof datum !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  const zeit = Date.parse(datum);
  return Number.isFinite(zeit) && new Date(zeit).toISOString().slice(0, 10) === datum ? { art, id, datum } : null;
}
