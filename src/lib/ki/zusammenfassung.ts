/**
 * KI-02: Notiz zusammenfassen und Lücken finden – Prompt, Parser, Markdown.
 * Ausgabe der KI: { zusammenfassung: string[], luecken: { stelle, grund }[] }
 */
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { alsObjekt, jsonLesen, text, textListe } from "./json.ts";
import { einbetten, kuerzen, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";

export const MIN_ZUSAMMENFASSUNG_ZEICHEN = 200;
export const MAX_ZUSAMMENFASSUNG_ZEICHEN = 12_000;
export const MAX_PUNKTE = 7;
export const MAX_LUECKEN = 10;

export type Luecke = { stelle: string; grund: string };
export type Zusammenfassung = { zusammenfassung: string[]; luecken: Luecke[] };

export function zusammenfassungMoeglich(inhalt: string): boolean {
  return inhalt.trim().length >= MIN_ZUSAMMENFASSUNG_ZEICHEN;
}

export function zusammenfassungPromptBauen(notiz: { titel: string; inhalt: string }) {
  const inhalt = notiz.inhalt.trim();
  if (inhalt.length < MIN_ZUSAMMENFASSUNG_ZEICHEN) {
    throw new KiEingabe(`Die Notiz ist zu kurz zum Zusammenfassen (mindestens ${MIN_ZUSAMMENFASSUNG_ZEICHEN} Zeichen).`);
  }
  const { text: material, gekuerzt } = kuerzen(inhalt, MAX_ZUSAMMENFASSUNG_ZEICHEN);
  const system = [
    "Du hilfst Studierenden, ihre Mitschriften zu verstehen und zu vervollständigen.",
    "1. Fasse die Notiz in 3 bis 7 kurzen Stichpunkten zusammen – nur mit dem, was in der Notiz steht.",
    "2. Nenne Stellen, die unklar oder unvollständig wirken (z. B. Formel ohne Herleitung, Begriff ohne Erklärung, abgebrochener Gedanke), jeweils mit kurzem Grund. Wenn nichts fehlt, gib eine leere Liste zurück – erfinde keine Lücken.",
    "Schreib in derselben Sprache wie die Notiz.",
    MATERIAL_REGEL,
    'Antworte nur mit JSON: {"zusammenfassung":["…"],"luecken":[{"stelle":"…","grund":"…"}]}',
    'Hat die Notiz keinen Lerninhalt, antworte mit {"zusammenfassung":[],"luecken":[]}.',
  ].join("\n");
  const nutzer = `Titel der Notiz: ${markerEntschaerfen(notiz.titel.trim() || "Ohne Titel")}\n\n${einbetten(material, "notiz")}`;
  return { system, nutzer, gekuerzt };
}

export function zusammenfassungParsen(antwort: string): Zusammenfassung {
  const daten = alsObjekt(jsonLesen(antwort));
  const zusammenfassung = textListe(daten.zusammenfassung, 400, MAX_PUNKTE);
  const luecken: Luecke[] = [];
  if (Array.isArray(daten.luecken)) {
    for (const roh of daten.luecken) {
      const l = alsObjekt(roh);
      const stelle = text(l.stelle, 200);
      const grund = text(l.grund, 300);
      if (stelle && grund) luecken.push({ stelle, grund });
      if (luecken.length >= MAX_LUECKEN) break;
    }
  }
  if (zusammenfassung.length === 0) throw new KiKeineDaten("Aus dieser Notiz ließ sich keine Zusammenfassung erstellen.");
  return { zusammenfassung, luecken };
}

/** Abschnitt zum Einfügen in die Notiz (Markdown wie im Notiz-Editor). */
export function zusammenfassungAlsMarkdown(z: Zusammenfassung, mitLuecken: boolean): string {
  const teile = ["## Zusammenfassung", "", ...z.zusammenfassung.map((p) => `- ${p}`)];
  if (mitLuecken && z.luecken.length) {
    teile.push("", "### Offene Punkte", "", ...z.luecken.map((l) => `- [ ] **${l.stelle}** – ${l.grund}`));
  }
  return teile.join("\n");
}
