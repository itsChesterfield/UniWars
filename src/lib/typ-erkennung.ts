import * as chrono from "chrono-node";
import type { Enums } from "@/lib/supabase/types";

/**
 * "PRUEFUNG" ist kein deadline_typ-Wert, sondern signalisiert, dass die
 * Eingabe eine eigene pruefung-Entität ist statt einer deadline (siehe Spec
 * Abschnitt 1.7: "Prüfung -> eigene Entität").
 */
export type ErkannterTyp = Enums<"deadline_typ"> | "PRUEFUNG";

const KEYWORDS: { pattern: RegExp; typ: ErkannterTyp }[] = [
  { pattern: /\b(klausur|prüfung|test|examen)\b/i, typ: "PRUEFUNG" },
  { pattern: /\b(abgabe|abzugeben|hausarbeit|protokoll|bericht|essay)\b/i, typ: "ABGABE" },
  { pattern: /\b(treffen|meeting|termin|sprechstunde)\b/i, typ: "TERMIN" },
  { pattern: /\b(gruppe|team|zusammen mit|gruppenarbeit)\b/i, typ: "GRUPPENARBEIT" },
];

export function erkenneTyp(text: string): { typ: ErkannterTyp; sicher: boolean } {
  for (const { pattern, typ } of KEYWORDS) {
    if (pattern.test(text)) return { typ, sicher: true };
  }
  return { typ: "ABGABE", sicher: false };
}

export function erkenneDatum(text: string): Date | null {
  return chrono.de.parseDate(text, new Date(), { forwardDate: true }) ?? null;
}
