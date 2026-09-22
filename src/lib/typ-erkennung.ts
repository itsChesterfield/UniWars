import * as chrono from "chrono-node";
import type { Enums } from "@/lib/supabase/types";

/**
 * "PRUEFUNG" ist kein deadline_typ-Wert, sondern signalisiert, dass die
 * Eingabe eine eigene pruefung-Entität ist statt einer deadline (siehe Spec
 * Abschnitt 1.7: "Prüfung -> eigene Entität").
 */
export type ErkannterTyp = Enums<"deadline_typ"> | "PRUEFUNG";

// Kein \b-Wortgrenzen-Matching: deutsche Komposita kleben Wörter ohne
// Leerzeichen aneinander ("Statistikklausur", "Abgabetermin"), da würde ein
// striktes \bklausur\b nichts finden. Stattdessen wird die gesamte
// Texteingabe als Teilstring durchsucht.
const KEYWORDS: { woerter: string[]; typ: ErkannterTyp }[] = [
  { woerter: ["klausur", "prüfung", "pruefung", "test", "examen"], typ: "PRUEFUNG" },
  { woerter: ["abgabe", "abzugeben", "hausarbeit", "protokoll", "bericht", "essay"], typ: "ABGABE" },
  { woerter: ["treffen", "meeting", "termin", "sprechstunde"], typ: "TERMIN" },
  { woerter: ["gruppenarbeit", "gruppe", "team", "zusammen mit"], typ: "GRUPPENARBEIT" },
];

export function erkenneTyp(text: string): { typ: ErkannterTyp; sicher: boolean } {
  const t = text.toLowerCase();
  for (const { woerter, typ } of KEYWORDS) {
    if (woerter.some((wort) => t.includes(wort))) return { typ, sicher: true };
  }
  return { typ: "ABGABE", sicher: false };
}

export function erkenneDatum(text: string): Date | null {
  return chrono.de.parseDate(text, new Date(), { forwardDate: true }) ?? null;
}
