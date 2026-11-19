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

export type MaterialArt = keyof typeof MATERIAL_ARTEN;
export type HubMaterial = { art: MaterialArt; id: string; titel: string; fachId: string | null };

export function materialPfad(material: Pick<HubMaterial, "art" | "id">): string {
  return MATERIAL_ARTEN[material.art].pfad + encodeURIComponent(material.id);
}


export type MaterialFachZuordnung = { art: string; material_id: string; fach_id: string; ausgeblendet: boolean };

export function fachZuordnungen(fachId: string | null, aenderungen: MaterialFachZuordnung[]): string[] {
  const faecher = new Set(fachId ? [fachId] : []);
  for (const eintrag of aenderungen) {
    if (eintrag.ausgeblendet) faecher.delete(eintrag.fach_id);
    else faecher.add(eintrag.fach_id);
  }
  return [...faecher];
}


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function materialVomPfad(pfad: string, suche: URLSearchParams): string | null {
  const pdfId = pfad.startsWith("/pdf-reader/") ? pfad.slice("/pdf-reader/".length) : "";
  if (UUID.test(pdfId)) return `datei:${pdfId}`;
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
