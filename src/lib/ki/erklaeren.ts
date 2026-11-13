/**
 * KI-11: "Erklär mir das" im Lernmodus. Material: Vorder- und Rückseite der Karte,
 * dazu – falls die Karte per KI-01 aus einer Notiz entstand – die Notiz als Kontext.
 */
import { einbetten, kuerzen, MATERIAL_REGEL } from "./material.ts";

export const MAX_KONTEXT_ZEICHEN = 6000;

export function erklaerungPromptBauen(karte: { vorderseite: string; rueckseite: string }, notiz?: { titel: string; inhalt: string } | null) {
  const system = [
    "Du bist Lernbegleiter in einer Lern-App für Studierende. Jemand hat eine Karteikarte nicht gewusst und möchte sie verstehen.",
    "Erkläre den Inhalt der Karte in 3 bis 5 kurzen, verständlichen Sätzen und gib danach genau ein konkretes Beispiel (beginne die Zeile mit „Beispiel:“).",
    "Stütze dich auf die Karte und – falls vorhanden – die Notiz. Ergänzt du allgemeines Wissen, bleib vorsichtig: keine erfundenen Zahlen, Namen oder Quellen.",
    "Ist die Karte unklar oder vermutlich falsch, sag das ehrlich, statt etwas zu erfinden.",
    "Schreib in derselben Sprache wie die Karte. Nutze Markdown nur sparsam (höchstens Fettdruck), keine Überschriften.",
    MATERIAL_REGEL,
  ].join("\n");
  const teile = [`Vorderseite:\n${einbetten(karte.vorderseite.trim(), "quelle")}`, `Rückseite:\n${einbetten(karte.rueckseite.trim(), "quelle")}`];
  if (notiz?.inhalt.trim()) {
    const { text } = kuerzen(notiz.inhalt.trim(), MAX_KONTEXT_ZEICHEN);
    teile.push(`Die Karte stammt aus dieser Notiz („${notiz.titel.replace(/[<>]/g, "") || "Ohne Titel"}“):\n${einbetten(text, "notiz")}`);
  }
  return { system, nutzer: teile.join("\n\n") };
}
