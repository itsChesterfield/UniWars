/**
 * KK-05: Spaced Repetition (angelehnt an SM-2 / Anki).
 * Nach dem Umdrehen bewertet man, wie gut man die Antwort wusste:
 *   1 Nochmal – nicht gewusst: Karte kommt in dieser Runde gleich wieder
 *   2 Schwer  – gewusst, aber mühsam: Intervall wächst nur wenig
 *   3 Gut     – gewusst: Intervall wächst mit der Leichtigkeit der Karte
 *   4 Einfach – sofort gewusst: großer Sprung, Karte wird "leichter"
 */

export type Bewertung = 1 | 2 | 3 | 4;

export const BEWERTUNGEN: { wert: Bewertung; name: string; klasse: string }[] = [
  { wert: 1, name: "Nochmal", klasse: "nochmal" },
  { wert: 2, name: "Schwer", klasse: "schwer" },
  { wert: 3, name: "Gut", klasse: "gut" },
  { wert: 4, name: "Einfach", klasse: "einfach" },
];

export function istBewertung(wert: unknown): wert is Bewertung {
  return wert === 1 || wert === 2 || wert === 3 || wert === 4;
}

export type KartenStand = {
  /** Tage bis zur nächsten Abfrage (0 = noch in der Lernphase) */
  intervall_tage: number;
  /** Faktor, um den das Intervall bei "Gut" wächst (1,3 … 5) */
  leichtigkeit: number;
  /** Erfolgreiche Wiederholungen in Folge */
  wiederholungen: number;
  /** Wie oft die Karte schon vergessen wurde */
  fehler: number;
};

export const START_LEICHTIGKEIT = 2.5;
const MIN_LEICHTIGKEIT = 1.3;
const MAX_LEICHTIGKEIT = 5;
const MAX_INTERVALL = 3650;
/** "Nochmal": in so vielen Minuten wieder fällig (falls die Runde abgebrochen wird). */
export const NOCHMAL_MINUTEN = 10;

const begrenzen = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Neuer Stand der Karte nach einer Bewertung. intervall_tage = 0 heißt: in wenigen Minuten wieder.
 *
 * `tageSeit` = Kalendertage seit der letzten Wiederholung (null = unbekannt → pünktlich angenommen).
 * Damit stimmt die Rechnung auch, wenn nicht genau am Fälligkeitstag gelernt wird:
 *  - zu früh (z. B. "Trotzdem alle lernen"): nur anteilige Verlängerung – am selben Tag fast keine
 *  - zu spät, aber noch gewusst: Bonus, weil die Karte offensichtlich länger hält
 */
export function bewerten(stand: KartenStand, bewertung: Bewertung, tageSeit: number | null = null): KartenStand {
  const ef = begrenzen(stand.leichtigkeit || START_LEICHTIGKEIT, MIN_LEICHTIGKEIT, MAX_LEICHTIGKEIT);
  const alt = Math.max(0, stand.intervall_tage);
  const neu = stand.wiederholungen === 0;

  if (bewertung === 1) {
    return {
      intervall_tage: 0,
      leichtigkeit: begrenzen(ef - 0.2, MIN_LEICHTIGKEIT, MAX_LEICHTIGKEIT),
      wiederholungen: 0,
      // nur zählen, wenn die Karte schon einmal gekonnt war
      fehler: stand.fehler + (neu ? 0 : 1),
    };
  }

  const vergangen = tageSeit === null || neu || alt === 0 ? alt : Math.max(0, tageSeit);
  // Anteil des Intervalls, der wirklich vergangen ist (1 = pünktlich oder später)
  const anteil = alt > 0 ? Math.min(1, vergangen / alt) : 1;
  const verspaetung = Math.max(0, vergangen - alt);

  // Ziel-Intervalle bei pünktlicher bzw. später Wiederholung
  const zielSchwer = Math.max(alt + 1, alt * 1.2);
  const zielGut = (alt + verspaetung / 2) * ef;
  const zielEinfach = (alt + verspaetung) * ef * 1.3;
  // Zu früh: nur der vergangene Anteil des Zuwachses zählt
  const anteilig = (ziel: number) => alt + (ziel - alt) * anteil;

  // Alle drei berechnen, damit Schwer < Gut < Einfach immer gilt
  const schwer = neu ? 1 : Math.max(1, Math.round(anteilig(zielSchwer)));
  const gut = Math.max(schwer + 1, neu ? 2 : Math.round(anteilig(zielGut)));
  const einfach = Math.max(gut + 1, neu ? 4 : Math.round(anteilig(zielEinfach)));

  const intervall = bewertung === 2 ? schwer : bewertung === 3 ? gut : einfach;
  // Frühe Wiederholungen verändern die Leichtigkeit nur anteilig (sonst treibt tägliches Üben sie hoch)
  const leichtigkeit = ef + (bewertung === 2 ? -0.15 : bewertung === 4 ? 0.15 : 0) * (neu ? 1 : anteil);

  return {
    intervall_tage: Math.min(intervall, MAX_INTERVALL),
    leichtigkeit: Math.round(begrenzen(leichtigkeit, MIN_LEICHTIGKEIT, MAX_LEICHTIGKEIT) * 100) / 100,
    wiederholungen: stand.wiederholungen + 1,
    fehler: stand.fehler,
  };
}

/** Kurztext für die Knöpfe: "10 Min.", "1 T.", "3 Wo.", "2 Mon.", "1,5 J." */
export function intervallText(tage: number): string {
  if (tage <= 0) return `${NOCHMAL_MINUTEN} Min.`;
  if (tage < 14) return `${tage} T.`;
  if (tage < 60) return `${Math.round(tage / 7)} Wo.`;
  if (tage < 365) return `${Math.round(tage / 30)} Mon.`;
  return `${(Math.round((tage / 365) * 10) / 10).toLocaleString("de-DE")} J.`;
}

/** Lernstand für die Anzeige im Stapel. */
export type Reife = "neu" | "lernen" | "jung" | "sicher";

export function reife(stand: { intervall_tage: number; zuletzt_gelernt: string | null }): Reife {
  if (stand.intervall_tage < 1) return stand.zuletzt_gelernt ? "lernen" : "neu";
  if (stand.intervall_tage < 21) return "jung";
  return "sicher";
}

export const REIFE_TEXT: Record<Reife, string> = {
  neu: "Neu",
  lernen: "Lernen",
  jung: "Jung",
  sicher: "Sicher",
};

/** Altes Leitner-Feld "Box" (1–5) für bestehende Anzeigen/Abfragen weiterpflegen. */
export function boxAusIntervall(tage: number): number {
  if (tage < 1) return 1;
  if (tage < 3) return 2;
  if (tage < 7) return 3;
  if (tage < 21) return 4;
  return 5;
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
