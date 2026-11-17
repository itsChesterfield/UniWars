/**
 * Design B3, Laden (DESIGN.md Abschnitt 7): Das Skelett hat die Form dessen, was kommt.
 * Sieben Formen wie im Dummy (`docs/design/b3-dummy/app.js`, `SKTYP`), hier zusätzlich nach Liste und Einzelansicht getrennt:
 * Die Liste der Präsentationen ist eine Tabelle, eine geöffnete Präsentation ein Blatt.
 */
export const SKELETT_FORMEN = ["kopf", "tabelle", "text", "zwei", "blatt", "gespraech", "flaeche"] as const;
export type SkelettForm = (typeof SKELETT_FORMEN)[number];

/** Form je Bereich: [Liste, Einzelansicht]. Erster Pfadteil ist der Bereich, alles danach die Einzelansicht. */
const FORM: Record<string, readonly [SkelettForm, SkelettForm]> = {
  "": ["kopf", "kopf"],
  termine: ["tabelle", "tabelle"],
  aufgaben: ["tabelle", "tabelle"],
  noten: ["tabelle", "tabelle"],
  faecher: ["tabelle", "tabelle"],
  fortschritt: ["kopf", "kopf"],
  "work-station": ["zwei", "zwei"],
  karteikarten: ["tabelle", "blatt"],
  notizen: ["text", "text"],
  "pdf-reader": ["tabelle", "blatt"],
  lernraum: ["zwei", "zwei"],
  dateiablage: ["tabelle", "tabelle"],
  literaturverwaltung: ["tabelle", "tabelle"],
  transkription: ["tabelle", "text"],
  chat: ["gespraech", "gespraech"],
  assistent: ["gespraech", "gespraech"],
  textverarbeitung: ["tabelle", "text"],
  tabellen: ["tabelle", "flaeche"],
  praesentationen: ["tabelle", "blatt"],
  mindmap: ["tabelle", "flaeche"],
  whiteboard: ["tabelle", "flaeche"],
  einstellungen: ["text", "text"],
};

/** Skelett-Form zu einem Pfad, z. B. "/mindmap/abc" → "flaeche". Unbekannte Bereiche bekommen den Kopf. */
export function skelettForm(pfad: string): SkelettForm {
  const teile = pfad.split(/[?#]/)[0].split("/").filter(Boolean);
  const eintrag = FORM[teile[0] ?? ""];
  if (!eintrag) return "kopf";
  // Karteikarten: Stapel (/karteikarten/[id]) ist eine Liste, erst Lernen und Quiz zeigen eine einzelne Karte
  if (teile[0] === "karteikarten") return teile.length >= 3 ? eintrag[1] : eintrag[0];
  // Einstellungen haben Unterseiten, aber keine Einzelansicht
  if (teile[0] === "einstellungen") return eintrag[0];
  return teile.length >= 2 ? eintrag[1] : eintrag[0];
}
