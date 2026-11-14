/**
 * KI-04: Transkript → gegliederte Mitschrift. Lange Transkripte (über 15.000 Zeichen)
 * laufen als Map-Reduce: Abschnitte von etwa 12.000 Zeichen werden einzeln aufbereitet,
 * ein letzter Aufruf führt alles zusammen. Jeder Aufruf ist eine gebuchte Anfrage.
 */
import { einbetten, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { textTeilen } from "../transkription/transkript.ts";

export const MIN_TRANSKRIPT_ZEICHEN = 200;
export const LANG_AB_ZEICHEN = 15_000;
export const ABSCHNITT_ZEICHEN = 12_000;
/** Mehr Abschnitte gibt es nicht (2 Stunden Vorlesung ≈ 90.000 Zeichen) */
export const MAX_ABSCHNITTE = 12;
export const MAX_MITSCHRIFT_ZEICHEN = 60_000;

/** Transkript in Abschnitte teilen (kurze Transkripte bleiben ein Abschnitt). */
export function abschnitte(text: string): string[] {
  const sauber = text.trim();
  if (sauber.length < MIN_TRANSKRIPT_ZEICHEN) throw new KiEingabe("Das Transkript ist zu kurz für eine Mitschrift.");
  if (sauber.length <= LANG_AB_ZEICHEN) return [sauber];
  const teile = textTeilen(sauber, ABSCHNITT_ZEICHEN);
  if (teile.length > MAX_ABSCHNITTE) throw new KiEingabe("Das Transkript ist zu lang für eine Mitschrift (höchstens etwa 2 Stunden).");
  return teile;
}

/** Wie viele Anfragen kostet die Aufbereitung? (Abschnitte + 1 zum Zusammenführen, wenn es mehrere sind) */
export function anfragenFuerMitschrift(anzahlAbschnitte: number): number {
  return anzahlAbschnitte <= 1 ? 1 : anzahlAbschnitte + 1;
}

const STIL = [
  "Gliedere mit Markdown: Überschriften (##, ###) für Themen, darunter knappe Stichpunkte (-).",
  "Lass Füllwörter, Wiederholungen, Versprecher und Organisatorisches ohne Lernwert weg (z. B. „Können Sie mich hören?“).",
  "Behalte Fachbegriffe, Definitionen, Formeln, Beispiele und Hinweise wie „klausurrelevant“.",
  "Nimm nur auf, was im Transkript gesagt wird. Erfinde nichts und ergänze kein Wissen von außen.",
  "Schreib in derselben Sprache wie das Transkript.",
  "Antworte nur mit der Mitschrift in Markdown, ohne Einleitung und ohne Codeblock.",
];

/** Prompt für einen Abschnitt (bei kurzen Transkripten: das ganze Transkript). */
export function mitschriftPrompt(titel: string, text: string, nr = 1, von = 1): { system: string; nutzer: string } {
  const system = [
    "Du machst aus dem Transkript einer gesprochenen Vorlesung eine gut lesbare, gegliederte Mitschrift für Studierende.",
    ...STIL,
    von > 1 ? `Das ist Abschnitt ${nr} von ${von}. Fang ohne Hauptüberschrift an und schreib keinen Schluss – die Abschnitte werden später zusammengeführt.` : "Beginne mit einer Hauptüberschrift (#) für das Thema.",
    MATERIAL_REGEL,
  ].join("\n");
  const kopf = von > 1 ? `Aufnahme: ${markerEntschaerfen(titel)} (Abschnitt ${nr} von ${von})` : `Aufnahme: ${markerEntschaerfen(titel)}`;
  return { system, nutzer: `${kopf}\n\n${einbetten(text, "quelle")}` };
}

/** Prompt zum Zusammenführen der Abschnitts-Mitschriften. */
export function zusammenfuehrenPrompt(titel: string, teile: string[]): { system: string; nutzer: string } {
  const system = [
    "Du führst die Mitschriften mehrerer Abschnitte derselben Vorlesung zu einer einzigen Mitschrift zusammen.",
    "Behalte die Reihenfolge. Lege doppelte oder sehr ähnliche Überschriften zusammen und entferne Wiederholungen.",
    "Kürze nicht inhaltlich: Alle Fachbegriffe, Definitionen, Formeln und Beispiele bleiben erhalten.",
    "Beginne mit einer Hauptüberschrift (#) für das Thema der Vorlesung.",
    "Nimm nur auf, was in den Abschnitten steht. Erfinde nichts.",
    "Schreib in derselben Sprache wie die Abschnitte.",
    "Antworte nur mit der Mitschrift in Markdown, ohne Einleitung und ohne Codeblock.",
    MATERIAL_REGEL,
  ].join("\n");
  const bloecke = teile.map((t, i) => einbetten(t, "quelle", { abschnitt: i + 1 })).join("\n\n");
  return { system, nutzer: `Aufnahme: ${markerEntschaerfen(titel)}\n\n${bloecke}` };
}

/** KI-Antwort prüfen: Codeblock-Hülle entfernen, Mindestinhalt, Höchstlänge. */
export function mitschriftLesen(antwort: string): string {
  let text = antwort.trim();
  const block = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (block) text = block[1].trim();
  if (text.replace(/[#\-*\s]/g, "").length < 20) throw new KiKeineDaten("Aus dem Transkript ließ sich keine Mitschrift machen.");
  return text.slice(0, MAX_MITSCHRIFT_ZEICHEN);
}

/** Vom Browser zurückgeschickte Abschnitts-Mitschriften prüfen (für das Zusammenführen). */
export function teilMitschriftenPruefen(roh: unknown): string[] {
  if (!Array.isArray(roh) || roh.length < 2 || roh.length > MAX_ABSCHNITTE) throw new KiEingabe("Ungültige Abschnitte.");
  const teile = roh.map((t) => (typeof t === "string" ? t.trim() : ""));
  if (teile.some((t) => !t || t.length > MAX_MITSCHRIFT_ZEICHEN)) throw new KiEingabe("Ungültige Abschnitte.");
  if (teile.reduce((n, t) => n + t.length, 0) > MAX_ABSCHNITTE * 8_000) throw new KiEingabe("Die Abschnitte sind zu lang zum Zusammenführen.");
  return teile;
}
