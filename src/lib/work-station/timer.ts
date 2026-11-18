// Reine Timer-Logik der Work Station (WS-01, WS-03, WS-04) – ohne React, gut testbar.
// Alles läuft über Zeitstempel, damit der Timer beim Seitenwechsel weiterläuft (WS-06).

export type WsEinstellungen = {
  fokus: number;
  kurzePause: number;
  langePause: number;
  runden: number;
  ton: boolean;
};

export const WS_STANDARD: WsEinstellungen = { fokus: 25, kurzePause: 5, langePause: 15, runden: 4, ton: true };

export const WS_GRENZEN = {
  fokus: [5, 180],
  kurzePause: [1, 30],
  langePause: [5, 60],
  runden: [2, 8],
} as const satisfies Record<Exclude<keyof WsEinstellungen, "ton">, readonly [number, number]>;

// WS-03: abgebrochene Fokus-Runden zählen erst ab 5 Minuten
export const MIN_ABBRUCH_MINUTEN = 5;

function begrenzen(wert: unknown, [min, max]: readonly [number, number], standard: number): number {
  const zahl = typeof wert === "number" ? wert : Number(wert);
  if (!Number.isFinite(zahl)) return standard;
  return Math.min(max, Math.max(min, Math.round(zahl)));
}

export function einstellungenLesen(roh: unknown): WsEinstellungen {
  const e = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  return {
    fokus: begrenzen(e.fokus, WS_GRENZEN.fokus, WS_STANDARD.fokus),
    kurzePause: begrenzen(e.kurzePause, WS_GRENZEN.kurzePause, WS_STANDARD.kurzePause),
    langePause: begrenzen(e.langePause, WS_GRENZEN.langePause, WS_STANDARD.langePause),
    runden: begrenzen(e.runden, WS_GRENZEN.runden, WS_STANDARD.runden),
    ton: typeof e.ton === "boolean" ? e.ton : WS_STANDARD.ton,
  };
}

export type Modus = "fokus" | "kurz" | "lang";

export const MODUS_NAME: Record<Modus, string> = { fokus: "Fokus", kurz: "Kurze Pause", lang: "Lange Pause" };

export type TimerZustand = {
  modus: Modus;
  /** Abgeschlossene Fokus-Runden im aktuellen Zyklus (bis zur langen Pause). */
  erledigteRunden: number;
  laeuft: boolean;
  /** Ende der Phase (ms seit Epoch), nur während der Timer läuft. */
  endetUm: number | null;
  /** Restzeit, solange der Timer steht. */
  restMs: number;
  dauerMs: number;
  /** Erster Start der aktuellen Fokus-Phase – wird als Sitzungsbeginn gespeichert. */
  fokusStart: number | null;
  fachId: string | null;
  einstellungen: WsEinstellungen;
  /** Gewählte Aufgabe (ältere gespeicherte Zustände haben das Feld nicht) */
  aufgabe?: FokusAufgabe | null;
  /** Nach einer Fokus-Runde: „Aufgabe abgeschlossen?“ steht noch aus */
  frage?: FokusAufgabe | null;
};

export type Sitzung = { start: number; minuten: number; abgeschlossen: boolean };

/** Aufgabe, an der in der Fokus-Runde gearbeitet wird (Abgabe, To-do, Prüfungsvorbereitung) */
export type AufgabeTyp = "deadline" | "todo" | "pruefung";
export type FokusAufgabe = { typ: AufgabeTyp; id: string; titel: string };

function phasenDauer(modus: Modus, e: WsEinstellungen): number {
  const minuten = modus === "fokus" ? e.fokus : modus === "kurz" ? e.kurzePause : e.langePause;
  return minuten * 60_000;
}

function phase(modus: Modus, z: Pick<TimerZustand, "erledigteRunden" | "fachId" | "einstellungen" | "aufgabe" | "frage">): TimerZustand {
  const dauerMs = phasenDauer(modus, z.einstellungen);
  return {
    modus,
    erledigteRunden: z.erledigteRunden,
    laeuft: false,
    endetUm: null,
    restMs: dauerMs,
    dauerMs,
    fokusStart: null,
    fachId: z.fachId,
    einstellungen: z.einstellungen,
    aufgabe: z.aufgabe ?? null,
    frage: z.frage ?? null,
  };
}

export function startZustand(einstellungen: WsEinstellungen = WS_STANDARD, fachId: string | null = null): TimerZustand {
  return phase("fokus", { erledigteRunden: 0, fachId, einstellungen });
}

export function restzeit(z: TimerZustand, jetzt: number): number {
  if (z.laeuft && z.endetUm !== null) return Math.max(0, z.endetUm - jetzt);
  return z.restMs;
}

export function istAbgelaufen(z: TimerZustand, jetzt: number): boolean {
  return z.laeuft && restzeit(z, jetzt) === 0;
}

export function starten(z: TimerZustand, jetzt: number): TimerZustand {
  if (z.laeuft) return z;
  return {
    ...z,
    laeuft: true,
    endetUm: jetzt + z.restMs,
    fokusStart: z.modus === "fokus" ? (z.fokusStart ?? jetzt) : null,
  };
}

export function pausieren(z: TimerZustand, jetzt: number): TimerZustand {
  if (!z.laeuft) return z;
  return { ...z, laeuft: false, endetUm: null, restMs: restzeit(z, jetzt) };
}

/** Bisher gelaufene Fokuszeit als Sitzung, falls sie zählt (WS-03). */
function abbruchSitzung(z: TimerZustand, jetzt: number): Sitzung | null {
  if (z.modus !== "fokus" || z.fokusStart === null) return null;
  const minuten = Math.floor((z.dauerMs - restzeit(z, jetzt)) / 60_000);
  if (minuten < MIN_ABBRUCH_MINUTEN) return null;
  return { start: z.fokusStart, minuten, abgeschlossen: false };
}

/** Aktuelle Phase auf Anfang. Eine Fokus-Runde ab 5 Minuten wird als Sitzung gezählt. */
export function zuruecksetzen(z: TimerZustand, jetzt: number): { zustand: TimerZustand; sitzung: Sitzung | null } {
  return { zustand: phase(z.modus, z), sitzung: abbruchSitzung(z, jetzt) };
}

function folgePhase(z: TimerZustand, rundeGezaehlt: boolean): TimerZustand {
  if (z.modus !== "fokus") {
    // Nach der langen Pause beginnt ein neuer Zyklus.
    const erledigteRunden = z.modus === "lang" ? 0 : z.erledigteRunden;
    return phase("fokus", { ...z, erledigteRunden });
  }
  const erledigteRunden = z.erledigteRunden + (rundeGezaehlt ? 1 : 0);
  const naechster: Modus = erledigteRunden > 0 && erledigteRunden % z.einstellungen.runden === 0 ? "lang" : "kurz";
  return phase(naechster, { ...z, erledigteRunden });
}

/** Phase ist abgelaufen: Fokus zählt voll, danach kommt die passende Pause. */
export function abschliessen(z: TimerZustand): { zustand: TimerZustand; sitzung: Sitzung | null } {
  const sitzung: Sitzung | null =
    z.modus === "fokus"
      ? { start: z.fokusStart ?? Date.now() - z.dauerMs, minuten: Math.round(z.dauerMs / 60_000), abgeschlossen: true }
      : null;
  const zustand = folgePhase(z, true);
  // Nach einer Fokus-Runde mit abhakbarer Aufgabe fragen, ob sie erledigt ist (Prüfungen: nur Lernzeit)
  if (z.modus === "fokus" && z.aufgabe && z.aufgabe.typ !== "pruefung") zustand.frage = z.aufgabe;
  return { zustand, sitzung };
}

/** Phase vorzeitig beenden. Fokus zählt nur ab 5 Minuten (mit der tatsächlich gelaufenen Zeit). */
export function ueberspringen(z: TimerZustand, jetzt: number): { zustand: TimerZustand; sitzung: Sitzung | null } {
  return { zustand: folgePhase(z, false), sitzung: abbruchSitzung(z, jetzt) };
}

/** Neue Einstellungen übernehmen; eine stehende, unberührte Phase bekommt die neue Länge. */
export function einstellungenAnwenden(z: TimerZustand, einstellungen: WsEinstellungen): TimerZustand {
  const neu = { ...z, einstellungen };
  const unberuehrt = !z.laeuft && z.restMs === z.dauerMs;
  return unberuehrt ? phase(z.modus, neu) : neu;
}

export function alsUhr(ms: number): string {
  const sekunden = Math.ceil(ms / 1000);
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor(sekunden / 60) % 60;
  const s = sekunden % 60;
  const uhr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  // Ab einer Stunde mit Stunden (1:30:00), sonst wie gewohnt (25:00)
  return h > 0 ? `${h}:${uhr}` : uhr;
}

export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export type StellBereich = { feld: "fokus" | "kurzePause" | "langePause"; min: number; max: number; schritt: number; runde: number };

/** Welche Einstellung der Kreis gerade stellt, Grenzen, Schrittweite und Minuten pro voller Kreisrunde */
export function stellBereich(modus: Modus): StellBereich {
  if (modus === "kurz") return { feld: "kurzePause", min: WS_GRENZEN.kurzePause[0], max: WS_GRENZEN.kurzePause[1], schritt: 1, runde: 30 };
  if (modus === "lang") return { feld: "langePause", min: WS_GRENZEN.langePause[0], max: WS_GRENZEN.langePause[1], schritt: 5, runde: 60 };
  // Fokus wie eine Uhr: eine Runde ist eine Stunde, weiterziehen gibt die nächste Stunde dazu
  return { feld: "fokus", min: WS_GRENZEN.fokus[0], max: WS_GRENZEN.fokus[1], schritt: 5, runde: 60 };
}

const winkelNorm = (w: number) => ((w % 360) + 360) % 360;
const aufSchritt = (m: number, b: StellBereich) => Math.min(b.max, Math.max(b.min, Math.round(m / b.schritt) * b.schritt));

/** Wo der Punkt steht (0 bis 1 einer Kreisrunde) und wie viele volle Runden darunter liegen */
export function kreisStand(minuten: number, b: StellBereich): { anteil: number; volleRunden: number } {
  const volleRunden = Math.max(0, Math.ceil(minuten / b.runde) - 1);
  return { anteil: (minuten - volleRunden * b.runde) / b.runde, volleRunden };
}

/** Direkter Klick auf den Kreis (0° oben, im Uhrzeigersinn): Stelle innerhalb der aktuellen Runde */
export function klickMinuten(winkel: number, b: StellBereich, vorher: number): number {
  const { volleRunden } = kreisStand(vorher, b);
  return aufSchritt(volleRunden * b.runde + (winkelNorm(winkel) / 360) * b.runde, b);
}

/**
 * Ziehen: Der Winkel-Unterschied zur letzten Position zählt, so geht es über 12 Uhr hinaus in die nächste Runde.
 * `roh` ist der ungerundete Wert (am Rand begrenzt, damit Zurückziehen sofort wirkt).
 */
export function zugMinuten(roh: number, vonWinkel: number, nachWinkel: number, b: StellBereich): { roh: number; minuten: number } {
  let d = winkelNorm(nachWinkel - vonWinkel);
  if (d > 180) d -= 360;
  const neu = Math.min(b.max, Math.max(b.min, roh + (d / 360) * b.runde));
  return { roh: neu, minuten: aufSchritt(neu, b) };
}
