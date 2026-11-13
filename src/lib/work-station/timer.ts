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
  fokus: [5, 90],
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
};

export type Sitzung = { start: number; minuten: number; abgeschlossen: boolean };

function phasenDauer(modus: Modus, e: WsEinstellungen): number {
  const minuten = modus === "fokus" ? e.fokus : modus === "kurz" ? e.kurzePause : e.langePause;
  return minuten * 60_000;
}

function phase(modus: Modus, z: Pick<TimerZustand, "erledigteRunden" | "fachId" | "einstellungen">): TimerZustand {
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
  return { zustand: folgePhase(z, true), sitzung };
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
  const m = Math.floor(sekunden / 60);
  const s = sekunden % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
