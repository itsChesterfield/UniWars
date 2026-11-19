import { BEREICHE } from "@/lib/dashboard-bereiche";
import { ICONS } from "@/lib/icons";
import { bereichHref, standardSymbolleiste, symbolleistenGruppen, type Symbolleiste } from "@/lib/personalisierung";

/** Die Hubs in der Sidebar – auch für Titel in der geteilten Ansicht. */

export const ZENTRALER_HUB = { name: "Zentraler Hub", href: "/", icon: ICONS.hub };

export const WEITERE_HUBS: { name: string; icon: string; href?: string }[] = [
  {
    name: "Dateiablage",
    href: "/dateiablage",
    icon: ICONS.dateiablage,
  },
  {
    name: "Notizen",
    href: "/notizen",
    icon: ICONS.notizen,
  },
  {
    name: "Karteikarten",
    href: "/karteikarten",
    icon: ICONS.karteikarten,
  },
  {
    name: "PDF Reader",
    href: "/pdf-reader",
    icon: ICONS.pdf,
  },
  {
    name: "Lernraum",
    href: "/lernraum",
    icon: ICONS.lernraum,
  },
  {
    name: "Work Station",
    href: "/work-station",
    icon: ICONS.fokus,
  },
  {
    name: "MindMap",
    href: "/mindmap",
    icon: ICONS.mindmap,
  },
  {
    name: "Whiteboard",
    href: "/whiteboard",
    icon: ICONS.whiteboard,
  },
  {
    name: "Literatur",
    href: "/literaturverwaltung",
    icon: ICONS.literatur,
  },
  {
    name: "Textverarbeitung",
    href: "/textverarbeitung",
    icon: ICONS.text,
  },
  {
    name: "Präsentationen",
    href: "/praesentationen",
    icon: ICONS.praesentation,
  },
  {
    name: "Tabellen",
    href: "/tabellen",
    icon: ICONS.tabelle,
  },
  {
    name: "Transkription",
    href: "/transkription",
    icon: ICONS.mikrofon,
  },
  {
    name: "Chat",
    href: "/chat",
    icon: ICONS.chat,
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

export type HubEintrag = { name: string; href: string; icon: string };

const ALLE: HubEintrag[] = [ZENTRALER_HUB, ...WEITERE_HUBS.filter((h): h is HubEintrag => Boolean(h.href))];

/** Hub zu einer Kennung der Symbolleiste ("hub", "notizen" …). */
export const hubVonId = (id: string): HubEintrag | null => ALLE.find((h) => h.href === bereichHref(id)) ?? null;

/**
 * Design B3: Gruppen der Symbolleiste (DESIGN.md Abschnitt 4) in der Reihenfolge aus der Personalisierung.
 * Ausgeblendete Bereiche fehlen hier, bleiben aber über die Befehlspalette erreichbar.
 */
export function hubsInGruppen(s: Symbolleiste = standardSymbolleiste()): { name: string; hubs: HubEintrag[] }[] {
  return symbolleistenGruppen(s).map((g) => ({
    name: g.name,
    hubs: g.eintraege.filter((e) => e.sichtbar).map((e) => hubVonId(e.id)).filter((h): h is HubEintrag => Boolean(h)),
  }));
}

/** Hub zu einem Pfad (für die Kopfleiste); Unterseiten des Zentralen Hubs zählen zum Zentralen Hub. */
export function hubAusPfad(pfad: string): { hub: HubEintrag | null; unterseite: string | null } {
  const sauber = pfad.split(/[?#]/)[0];
  const bereich = BEREICHE.find((b) => b.href === sauber);
  if (bereich) return { hub: ZENTRALER_HUB, unterseite: bereich.href === "/" ? null : bereich.name };
  const hub = WEITERE_HUBS.find((h) => h.href && (sauber === h.href || sauber.startsWith(`${h.href}/`)));
  return { hub: hub?.href ? (hub as HubEintrag) : null, unterseite: null };
}

/** Kurze Namen für die Tab-Leiste am Handy. Dort stehen die ersten vier sichtbaren Bereiche der Symbolleiste. */
export const KURZNAMEN: Record<string, string> = {
  hub: "Hub",
  "work-station": "Fokus",
  karteikarten: "Karten",
  notizen: "Notizen",
  "pdf-reader": "PDF",
  lernraum: "Lernraum",
  dateiablage: "Dateien",
  literaturverwaltung: "Literatur",
  transkription: "Aufnahme",
  chat: "Chat",
  textverarbeitung: "Text",
  tabellen: "Tabellen",
  praesentationen: "Folien",
  mindmap: "MindMap",
  whiteboard: "Board",
};
