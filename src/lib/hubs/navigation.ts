import { BEREICHE } from "@/lib/dashboard-bereiche";

/** Die Hubs in der Sidebar – auch für Titel in der geteilten Ansicht. */

export const ZENTRALER_HUB = { name: "Zentraler Hub", href: "/", icon: "M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6" };

export const WEITERE_HUBS: { name: string; icon: string; href?: string }[] = [
  {
    name: "Dateiablage",
    href: "/dateiablage",
    icon: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  },
  {
    name: "Notizen",
    href: "/notizen",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M9 13h6M9 16.5h4",
  },
  {
    name: "Karteikarten",
    href: "/karteikarten",
    icon: "rect:4,6,13,14,2|M8 3h9a2 2 0 0 1 2 2v11",
  },
  {
    name: "PDF Reader",
    href: "/pdf-reader",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M8.5 15.5h2v3M13 13.5h2v5M8.5 12.5h1.5",
  },
  {
    name: "Lernraum",
    href: "/lernraum",
    icon: "M4 19.5V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2Z|M8 4v8l2.5-1.5L13 12V4|M17.5 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z",
  },
  {
    name: "Work Station",
    href: "/work-station",
    icon: "circle:12,13,7|M12 13V9.5M9.5 3.5h5M12 3.5V6",
  },
  {
    name: "MindMap",
    href: "/mindmap",
    icon: "circle:6,6,2.5|circle:18,7,2.5|circle:10,18,2.5|M8 7.5 15.5 8M8 16 9 9.5",
  },
  {
    name: "Whiteboard",
    href: "/whiteboard",
    icon: "rect:3,4,18,14,2|m8 21 4-3 4 3|M7 9h6M7 13h9",
  },
  {
    name: "Literaturverwaltung",
    href: "/literaturverwaltung",
    icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5Z|M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5Z",
  },
  {
    name: "Textverarbeitung",
    href: "/textverarbeitung",
    icon: "M5 7V5h14v2M12 5v14M9.5 19h5",
  },
  {
    name: "Präsentationen",
    href: "/praesentationen",
    icon: "rect:3,4,18,12,2|M12 16v3M8.5 21h7",
  },
  {
    name: "Tabellen",
    href: "/tabellen",
    icon: "rect:3.5,4.5,17,15,2|M3.5 9.5h17M9 9.5v10M3.5 14.5h17",
  },
  {
    name: "Transkription",
    href: "/transkription",
    icon: "rect:9,3,6,11,3|M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  },
  {
    name: "Assistent",
    href: "/assistent",
    icon: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z",
  },
  {
    name: "Chat",
    href: "/chat",
    icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-5 4Z",
  },
];

/** Name des Hubs zu einem Pfad, z. B. "/notizen?id=1" → "Notizen". */
export function hubNameAusPfad(href: string): string {
  const pfad = href.split(/[?#]/)[0];
  if (pfad === "/") return ZENTRALER_HUB.name;
  const bereich = BEREICHE.find((b) => b.href === pfad);
  if (bereich) return bereich.name;
  const hub = WEITERE_HUBS.find((h) => h.href && (pfad === h.href || pfad.startsWith(`${h.href}/`)));
  return hub?.name ?? "Ansicht";
}
