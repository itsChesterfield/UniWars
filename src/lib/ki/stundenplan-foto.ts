/**
 * Stundenplan aus einem Foto: Prompt und Prüfung der KI-Antwort (ohne Next.js, testbar).
 * Die KI liest nur ab – eingetragen wird erst, wenn der Nutzer die Vorschau bestätigt.
 */
import { alsObjekt, jsonLesen, text } from "./json.ts";

export type Wochentag = "MO" | "DI" | "MI" | "DO" | "FR" | "SA" | "SO";

export type FotoEintrag = {
  fach: string;
  tag: Wochentag;
  start: string;
  ende: string;
  raum: string | null;
  dozent: string | null;
};

export const MAX_FOTO_EINTRAEGE = 60;
/** Höchstgröße des (im Browser verkleinerten) Bildes als Data-URL */
export const MAX_BILD_ZEICHEN = 3_000_000;

const TAG_ALIASE: Record<string, Wochentag> = {
  mo: "MO", montag: "MO", mon: "MO", monday: "MO",
  di: "DI", dienstag: "DI", tue: "DI", tuesday: "DI",
  mi: "MI", mittwoch: "MI", wed: "MI", wednesday: "MI",
  do: "DO", donnerstag: "DO", thu: "DO", thursday: "DO",
  fr: "FR", freitag: "FR", fri: "FR", friday: "FR",
  sa: "SA", samstag: "SA", sat: "SA", saturday: "SA",
  so: "SO", sonntag: "SO", sun: "SO", sunday: "SO",
};

export function tagLesen(wert: unknown): Wochentag | null {
  if (typeof wert !== "string") return null;
  const schluessel = wert.trim().toLowerCase().replace(/\.$/, "");
  return TAG_ALIASE[schluessel] ?? null;
}

/** "8:15", "08.15", "8 Uhr", "815" → "08:15"; Unsinn → null */
export function zeitLesen(wert: unknown): string | null {
  if (typeof wert !== "string" && typeof wert !== "number") return null;
  const roh = String(wert).trim().toLowerCase().replace(/\s*uhr$/, "");
  let m = roh.match(/^(\d{1,2})[:.h](\d{2})$/);
  if (!m) {
    const nur = roh.match(/^(\d{1,2})$/);
    if (nur) m = [roh, nur[1], "00"];
    const kompakt = roh.match(/^(\d{1,2})(\d{2})$/);
    if (!m && kompakt) m = [roh, kompakt[1], kompakt[2]];
  }
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function fotoPromptBauen(faecher: string[]): { system: string; nutzer: string } {
  const bekannte = faecher.length
    ? `Bereits angelegte Fächer (nutze genau diese Schreibweise, wenn eine Veranstaltung offensichtlich dazugehört): ${faecher.map((f) => `"${f}"`).join(", ")}.`
    : "Es sind noch keine Fächer angelegt.";
  return {
    system: [
      "Du liest Stundenpläne von Studierenden aus Fotos oder Screenshots ab.",
      "Gib NUR ein JSON-Objekt zurück: {\"eintraege\": [{\"fach\": string, \"tag\": \"MO\"|\"DI\"|\"MI\"|\"DO\"|\"FR\"|\"SA\"|\"SO\", \"start\": \"HH:MM\", \"ende\": \"HH:MM\", \"raum\": string|null, \"dozent\": string|null}]}.",
      "Regeln: Jede wöchentliche Veranstaltung ist ein Eintrag; findet sie an mehreren Tagen statt, dann ein Eintrag pro Tag. Jeder Kasten im Plan ergibt genau einen Eintrag – nichts doppelt.",
      "Wochentag und Uhrzeit: Steht im Kasten selbst ein Tag oder eine Zeit (z. B. 'Montag, 09:45 - 11:15'), gilt diese Angabe – nicht die Spalte oder Zeile, in der der Kasten zu stehen scheint. Sonst die Spaltenüberschrift genau prüfen (Spalten können unterschiedlich breit sein).",
      "Dozent nur, wenn ein Personenname dasteht. Veranstaltungsarten wie 'Seminaristischer Lehrvortrag', 'PC-Übung', 'Praktische Übung', SWS-Angaben oder Sprache sind KEIN Dozent.",
      "Uhrzeiten im 24-Stunden-Format. Fachname kurz und ohne Raum/Dozent/Kürzel wie 'VL' oder 'Ü' – außer Übung und Vorlesung sind getrennte Fächer im Plan.",
      "Nichts erfinden: Was nicht lesbar ist, weglassen bzw. null. Keine Pausen, keine leeren Zeitslots.",
      "Ist auf dem Bild kein Stundenplan, gib {\"eintraege\": []} zurück.",
    ].join("\n"),
    nutzer: `Lies alle Veranstaltungen aus diesem Stundenplan ab. ${bekannte}`,
  };
}

/** Veranstaltungsarten o. Ä., die die KI fälschlich als Dozent abliest */
const KEIN_DOZENT = /lehrvortrag|lehrvertrag|vorlesung|übung|uebung|seminar|praktikum|tutorium|\bsws\b|deutsch|englisch|wöch|ungerade|gerade woche/i;

export function dozentLesen(wert: unknown): string | null {
  const d = text(wert, 100);
  return d && !KEIN_DOZENT.test(d) ? d : null;
}

/** KI-Antwort prüfen: nur vollständige, plausible Einträge, ohne Duplikate. */
export function fotoParsen(antwort: string): FotoEintrag[] {
  const roh = alsObjekt(jsonLesen(antwort)).eintraege;
  if (!Array.isArray(roh)) return [];
  const ergebnis: FotoEintrag[] = [];
  const gesehen = new Set<string>();
  for (const r of roh) {
    const o = alsObjekt(r);
    const fach = text(o.fach, 120);
    const tag = tagLesen(o.tag);
    const start = zeitLesen(o.start);
    const ende = zeitLesen(o.ende);
    if (!fach || !tag || !start || !ende || ende <= start) continue;
    const schluessel = `${fach.toLowerCase()}|${tag}|${start}|${ende}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    ergebnis.push({ fach, tag, start, ende, raum: text(o.raum, 100) || null, dozent: dozentLesen(o.dozent) });
    if (ergebnis.length >= MAX_FOTO_EINTRAEGE) break;
  }
  const reihenfolge: Wochentag[] = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
  return ergebnis.sort((a, b) => reihenfolge.indexOf(a.tag) - reihenfolge.indexOf(b.tag) || a.start.localeCompare(b.start));
}

const ZUSAETZE = new Set(["vl", "vorlesung", "ü", "üb", "übung", "uebung", "tut", "tutorium", "seminar", "s", "v", "ue"]);

function normalisieren(name: string) {
  return name
    .toLocaleLowerCase("de-DE")
    .split(/[^a-z0-9äöüß]+/)
    .filter((wort) => wort && !ZUSAETZE.has(wort))
    .join(" ");
}

/** Passendes vorhandenes Fach zu einem abgelesenen Namen (genau, dann ohne VL/Übung, dann Präfix). */
export function fachZuordnen<T extends { id: string; name: string }>(name: string, faecher: T[]): T | null {
  const genau = faecher.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (genau) return genau;
  const n = normalisieren(name);
  if (!n) return null;
  const gleich = faecher.find((f) => normalisieren(f.name) === n);
  if (gleich) return gleich;
  return faecher.find((f) => {
    const fn = normalisieren(f.name);
    return fn.length >= 4 && (n.startsWith(fn) || fn.startsWith(n));
  }) ?? null;
}
