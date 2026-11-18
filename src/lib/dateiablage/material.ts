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
