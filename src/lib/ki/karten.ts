/**
 * KI-01: Karteikarten aus Material (Notiz, PDF-Seiten, Transkript) – Prompt bauen
 * und Antwort prüfen. Reine Logik ohne Netzwerk, damit sie vollständig testbar ist.
 */
import { KiEingabe, KiKeineKarten } from "./fehler.ts";
import { einbetten, kuerzen, MATERIAL_REGEL, materialName, markerEntschaerfen, tagFuer, type MaterialQuelle } from "./material.ts";

export const ERLAUBTE_ANZAHL = [5, 10, 15] as const;
export type KartenAnzahl = (typeof ERLAUBTE_ANZAHL)[number];

export const MIN_NOTIZ_ZEICHEN = 50;
export const MAX_NOTIZ_ZEICHEN = 12_000;
/** wie die DB-Constraint in kk_karte */
export const MAX_SEITE_ZEICHEN = 5000;

export type Vorschlag = { vorderseite: string; rueckseite: string };

/** Lernmaterial beliebiger Herkunft */
export type Material = { titel: string; text: string; quelle: MaterialQuelle };

export function istErlaubteAnzahl(wert: unknown): wert is KartenAnzahl {
  return (ERLAUBTE_ANZAHL as readonly unknown[]).includes(wert);
}

/** Lang genug für Karteikarten? (gleiche Regel für Button und Server) */
export function notizLangGenug(inhalt: string): boolean {
  return inhalt.trim().length >= MIN_NOTIZ_ZEICHEN;
}

/** KI-01 für Notizen (unverändert) – nutzt die allgemeine Pipeline. */
export function promptBauen(
  notiz: { titel: string; inhalt: string },
  anzahl: KartenAnzahl,
): { system: string; nutzer: string; gekuerzt: boolean } {
  return kartenPromptBauen({ titel: notiz.titel, text: notiz.inhalt, quelle: "notiz" }, anzahl);
}

/** Karteikarten-Prompt für beliebiges Material (Notiz, PDF-Seiten, Transkript). */
export function kartenPromptBauen(material: Material, anzahl: KartenAnzahl): { system: string; nutzer: string; gekuerzt: boolean } {
  const inhalt = material.text.trim();
  if (inhalt.length < MIN_NOTIZ_ZEICHEN) throw new KiEingabe(`${materialName(material.quelle)} ist zu kurz für Karteikarten.`);
  const { text, gekuerzt } = kuerzen(inhalt, MAX_NOTIZ_ZEICHEN);
  const tag = tagFuer(material.quelle);
  const wovon = material.quelle === "notiz" ? "in der Notiz" : "im Material";

  const system = [
    "Du erstellst Karteikarten für Studierende, die mit Wiederholung in Abständen (Spaced Repetition) lernen.",
    `Erstelle höchstens ${anzahl} Karteikarten – und nur aus Inhalten, die ${wovon} stehen. Erfinde nichts dazu.`,
    "Jede Karte hat auf der Vorderseite genau eine Frage oder einen Begriff und auf der Rückseite eine kurze, präzise Antwort (höchstens etwa 3 Sätze).",
    `Schreib die Karten in derselben Sprache wie das Material.`,
    MATERIAL_REGEL,
    'Antworte ausschließlich mit JSON in genau diesem Format: {"karten":[{"vorderseite":"…","rueckseite":"…"}]}',
    'Wenn das Material zu kurz ist oder keinen Lerninhalt hat, antworte mit {"karten":[]}.',
  ].join("\n");

  const titel = markerEntschaerfen(material.titel.trim() || "Ohne Titel");
  const art = material.quelle === "notiz" ? "der Notiz" : material.quelle === "pdf" ? "des Dokuments" : "der Aufnahme";
  const nutzer = `Titel ${art}: ${titel}\n\n${einbetten(text, tag)}`;
  return { system, nutzer, gekuerzt };
}

function jsonLesen(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // z. B. ```json … ``` oder erklärender Text drumherum: erstes { bis letztes }
    const start = text.indexOf("{");
    const ende = text.lastIndexOf("}");
    if (start === -1 || ende <= start) return null;
    try {
      return JSON.parse(text.slice(start, ende + 1));
    } catch {
      return null;
    }
  }
}

const seite = (wert: unknown) => (typeof wert === "string" ? wert.trim().slice(0, MAX_SEITE_ZEICHEN).trim() : "");

/** Prüft die KI-Antwort und macht daraus saubere Vorschläge. Wirft KiKeineKarten, wenn nichts übrig bleibt. */
export function kartenParsen(text: string, anzahl: number): Vorschlag[] {
  const daten = jsonLesen(text);
  const liste: unknown = Array.isArray(daten) ? daten : (daten as { karten?: unknown } | null)?.karten;
  const ergebnis: Vorschlag[] = [];
  const gesehen = new Set<string>();

  if (Array.isArray(liste)) {
    for (const eintrag of liste) {
      if (!eintrag || typeof eintrag !== "object") continue;
      const vorderseite = seite((eintrag as Record<string, unknown>).vorderseite);
      const rueckseite = seite((eintrag as Record<string, unknown>).rueckseite);
      if (!vorderseite || !rueckseite) continue;
      const schluessel = vorderseite.toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      ergebnis.push({ vorderseite, rueckseite });
      if (ergebnis.length >= anzahl) break;
    }
  }

  if (ergebnis.length === 0) throw new KiKeineKarten();
  return ergebnis;
}
