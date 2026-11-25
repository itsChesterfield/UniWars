/**
 * Ideen und Fehler aus der App heraus melden: je Bereich sitzt eine kleine Flagge,
 * die ein Formular (Titel und Beschreibung) öffnet und daraus ein Ticket in YouTrack anlegt.
 *
 * Nur reine Logik ohne Netzwerk oder Supabase, damit Tests sie prüfen. Der eigentliche Aufruf
 * der Edge Function liegt in der Komponente; der YouTrack-Token liegt ausschließlich in der
 * Edge Function (Supabase Secret), nie im Client.
 */

/** Die Bereiche, die eine eigene Flagge tragen. Deckt sich mit dem Hub-Epic-Mapping der Edge Function. */
export const IDEE_HUBS = [
  "hub",
  "dateiablage",
  "notizen",
  "karteikarten",
  "pdf",
  "workstation",
  "mindmap",
  "whiteboard",
  "literatur",
  "textverarbeitung",
  "praesentationen",
  "tabellen",
  "transkription",
  "chat",
] as const;

export type IdeeHub = (typeof IDEE_HUBS)[number];

/** Lesbarer Name des Bereichs für die Überschrift im Formular. */
export const HUB_LABEL: Record<IdeeHub, string> = {
  hub: "Zentraler Hub",
  dateiablage: "Dateiablage",
  notizen: "Notizen",
  karteikarten: "Karteikarten",
  pdf: "PDF Reader",
  workstation: "Work Station",
  mindmap: "MindMap",
  whiteboard: "Whiteboard",
  literatur: "Literatur",
  textverarbeitung: "Textverarbeitung",
  praesentationen: "Präsentationen",
  tabellen: "Tabellen",
  transkription: "Transkription",
  chat: "Chat",
};

/** Erstes Pfadsegment eines Bereichs auf den Hub-Schlüssel. Nur Bereiche hier bekommen eine Flagge. */
const ROUTE_HUB: Record<string, IdeeHub> = {
  "": "hub",
  dateiablage: "dateiablage",
  notizen: "notizen",
  karteikarten: "karteikarten",
  "pdf-reader": "pdf",
  "work-station": "workstation",
  mindmap: "mindmap",
  whiteboard: "whiteboard",
  literaturverwaltung: "literatur",
  textverarbeitung: "textverarbeitung",
  praesentationen: "praesentationen",
  tabellen: "tabellen",
  transkription: "transkription",
  chat: "chat",
};

/** Zu welchem Hub gehört ein Pfad (z. B. „/pdf-reader/123“ -> „pdf“)? Ohne Treffer null (keine Flagge). */
export function hubAusPfad(pfad: string): IdeeHub | null {
  const segment = pfad.replace(/^\/+/, "").split(/[/?#]/)[0] ?? "";
  return ROUTE_HUB[segment] ?? null;
}

export type IdeeEingabe = { title: string; description: string; hub: IdeeHub };

/** Prüft die Eingabe vor dem Senden. Titel ist Pflicht, Beschreibung darf leer sein. */
export function ideeGueltig(titel: string): boolean {
  return titel.trim().length > 0;
}
