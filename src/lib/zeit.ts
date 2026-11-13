// Uni-Alltag findet in Berlin statt – Server (Vercel) läuft aber in UTC.
export const ZEITZONE_BERLIN = "Europe/Berlin";

const WOCHENTAGE = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"] as const;
export type Wochentag = (typeof WOCHENTAGE)[number];

function teile(datum: Date) {
  const formatiert = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE_BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(datum);
  const wert = (typ: Intl.DateTimeFormatPartTypes) => formatiert.find((t) => t.type === typ)?.value ?? "";
  return {
    jahr: Number(wert("year")),
    monat: Number(wert("month")),
    tag: Number(wert("day")),
    stunde: Number(wert("hour")),
    minute: Number(wert("minute")),
    sekunde: Number(wert("second")),
    wochentag: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wert("weekday")),
  };
}

/** "YYYY-MM-DD" des Kalendertags in Berlin. */
export function berlinDatum(datum: Date = new Date()): string {
  const t = teile(datum);
  return `${t.jahr}-${String(t.monat).padStart(2, "0")}-${String(t.tag).padStart(2, "0")}`;
}

/** "HH:MM" Wanduhrzeit in Berlin. */
export function berlinUhrzeit(datum: Date = new Date()): string {
  const t = teile(datum);
  return `${String(t.stunde).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

export function berlinWochentag(datum: Date = new Date()): Wochentag {
  return WOCHENTAGE[teile(datum).wochentag];
}

/** Differenz Berlin-Wanduhr minus UTC in Millisekunden zu einem Zeitpunkt. */
function berlinVersatz(datum: Date): number {
  const t = teile(datum);
  const alsUtc = Date.UTC(t.jahr, t.monat - 1, t.tag, t.stunde, t.minute, t.sekunde);
  return alsUtc - Math.floor(datum.getTime() / 1000) * 1000;
}

/** Zeitpunkt von 00:00 Uhr Berliner Zeit am angegebenen Tag (+ optional Tage). */
export function berlinMitternacht(datumIso: string, plusTage = 0): Date {
  const [j, m, t] = datumIso.split("-").map(Number);
  const naiv = Date.UTC(j, m - 1, t + plusTage, 0, 0, 0);
  // Zweimal korrigieren, damit auch Tage mit Zeitumstellung stimmen.
  let ergebnis = naiv - berlinVersatz(new Date(naiv));
  ergebnis = naiv - berlinVersatz(new Date(ergebnis));
  return new Date(ergebnis);
}

export function datumDeutsch(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: ZEITZONE_BERLIN,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}
