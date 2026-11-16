import { berlinDatum, berlinTageZwischen, berlinUhrzeit } from "./zeit.ts";

const zwei = (n: number) => String(n).padStart(2, "0");

/** „morgen um 23:59“, „am Mittwoch, 9. Dezember, um 10:00“ oder „seit gestern überfällig“. */
export function faelligText(iso: string, jetzt: Date): string {
  const wann = new Date(iso);
  const tage = berlinTageZwischen(jetzt, wann);
  const uhr = berlinUhrzeit(wann);
  const zeit = uhr === "00:00" ? "" : ` um ${uhr}`;
  if (wann.getTime() < jetzt.getTime()) {
    if (tage === 0) return `seit ${uhr} überfällig`;
    if (tage === -1) return "seit gestern überfällig";
    return `seit ${-tage} Tagen überfällig`;
  }
  if (tage === 0) return `heute${zeit}`;
  if (tage === 1) return `morgen${zeit}`;
  if (tage === 2) return `übermorgen${zeit}`;
  const tag = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(wann);
  return `am ${tag}${zeit ? `,${zeit}` : ""}`;
}

/** Restzeit unter einem Tag als laufende Uhr „07:42:10“. */
export function restUhr(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${zwei(Math.floor(s / 3600))}:${zwei(Math.floor((s % 3600) / 60))}:${zwei(s % 60)}`;
}

/** Montag bis Sonntag der laufenden Woche als ISO-Datum (Berlin). */
export function wochenTage(jetzt: Date): string[] {
  const heute = berlinDatum(jetzt);
  const [j, m, t] = heute.split("-").map(Number);
  const mittag = new Date(Date.UTC(j, m - 1, t, 12));
  const seitMontag = (mittag.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(mittag.getTime() + (i - seitMontag) * 86_400_000).toISOString().slice(0, 10));
}

export function minutenText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
