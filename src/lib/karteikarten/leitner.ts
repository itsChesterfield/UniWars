// KK-05: Box -> Tage bis zur nächsten Abfrage
export const LEITNER_TAGE: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export const MAX_BOX = 5;

export type Antwort = "gewusst" | "nicht_gewusst";

/** Neue Box und in wie vielen Tagen (ab heute, Tagesbeginn) die Karte wieder fällig ist. */
export function naechsteWiederholung(box: number, antwort: Antwort): { box: number; tage: number } {
  const neueBox = antwort === "gewusst" ? Math.min(Math.max(box, 1) + 1, MAX_BOX) : 1;
  return { box: neueBox, tage: LEITNER_TAGE[neueBox] };
}

export function istFaellig(naechsteAbfrage: string, jetzt: Date = new Date()): boolean {
  return new Date(naechsteAbfrage).getTime() <= jetzt.getTime();
}

/** Anzahl fälliger Karten (Stand: jetzt). */
export function anzahlFaellig(karten: { naechste_abfrage: string }[], jetzt: Date = new Date()): number {
  return karten.filter((k) => istFaellig(k.naechste_abfrage, jetzt)).length;
}

// KK-06: Ab so vielen Karten zählt eine Lernrunde für den Streak.
export const STREAK_MIN_KARTEN = 10;
