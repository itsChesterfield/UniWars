/**
 * Automatisches Abmelden nach Inaktivität. Reine Logik + kleines Register für Dinge,
 * die die Sitzung wach halten (laufende Aufnahme, Podcast, Studio-Antwort).
 */
export const INAKTIV_MS = 5 * 60_000;
/** So lange vorher erscheint der Hinweis „Du wirst gleich abgemeldet“ */
export const WARNUNG_MS = 30_000;
export const LETZTE_AKTIVITAET = "uniwars-letzte-aktivitaet";

const halter = new Set<string>();

/** Etwas läuft, das keine Eingaben braucht (Aufnahme, Wiedergabe) – solange nicht abmelden */
export function aktivHalten(grund: string, an: boolean) {
  if (an) halter.add(grund);
  else halter.delete(grund);
}

export function wirdAktivGehalten(): boolean {
  return halter.size > 0;
}

export type InaktivStand = "aktiv" | "warnung" | "abmelden";

export function inaktivStand(letzteAktivitaet: number, jetzt: number, gehalten: boolean): InaktivStand {
  if (gehalten) return "aktiv";
  const ruhe = jetzt - letzteAktivitaet;
  if (ruhe >= INAKTIV_MS) return "abmelden";
  if (ruhe >= INAKTIV_MS - WARNUNG_MS) return "warnung";
  return "aktiv";
}
