/**
 * Zentraler Hub als Bühne (Entscheidung Didi, 19.11.): fünf Szenen, die sich beim Scrollen ablösen.
 * Hier nur Rechnung ohne React und ohne Supabase-Import, damit Tests sie prüfen.
 */
import { berlinDatum, berlinTageZwischen, berlinUhrzeit } from "./zeit.ts";
import { wochenTage } from "./hub-texte.ts";

export const SZENEN = [
  { id: "ueberblick", name: "Überblick" },
  { id: "woche", name: "Diese Woche" },
  { id: "lernen", name: "Lernen" },
  { id: "mensa", name: "Mensa" },
  { id: "dateien", name: "Dateien" },
] as const;
export type SzeneId = (typeof SZENEN)[number]["id"];

/** Welche Szene der Scrollstand zeigt (Szenenhöhe in px) */
export function szeneBeiScroll(scrollTop: number, hoehe: number, anzahl: number): number {
  if (hoehe <= 0) return 0;
  return Math.max(0, Math.min(anzahl - 1, Math.round(scrollTop / hoehe)));
}

type Deadline = { id: string; titel: string; faellig_am: string; erledigt: boolean; fach_id: string | null; typ?: string | null };
type Todo = { id: string; titel: string; erledigt: boolean; parent_id: string | null; fach_id: string | null; faellig_am: string | null; prioritaet?: string | null };
type Pruefung = { id: string; titel: string; datum: string; fach_id: string | null; status?: string | null; raum?: string | null };

export type Eintrag = { id: string; quelle: "deadline" | "todo" | "pruefung"; art: string; titel: string; fachId: string | null; wann: string | null; dringend: boolean };

const PRIO: Record<string, number> = { HOCH: 0, MITTEL: 1, NIEDRIG: 2 };

/** Offene Fristen, Prüfungen und To-dos, nach Zeit; To-dos ohne Datum nach Priorität dahinter */
export function alsNaechstes(d: { deadlines: Deadline[]; todos: Todo[]; pruefungen: Pruefung[] }, jetzt: Date): Eintrag[] {
  const tag = 86_400_000;
  const mitZeit: Eintrag[] = [
    ...d.deadlines.filter((x) => !x.erledigt).map((x) => ({ id: x.id, quelle: "deadline" as const, art: x.typ === "ABGABE" ? "Abgabe" : "Frist", titel: x.titel, fachId: x.fach_id, wann: x.faellig_am, dringend: false })),
    ...d.pruefungen
      .filter((x) => (x.status ?? "ANSTEHEND") === "ANSTEHEND" && new Date(x.datum).getTime() >= jetzt.getTime() - tag)
      .map((x) => ({ id: x.id, quelle: "pruefung" as const, art: "Prüfung", titel: x.titel, fachId: x.fach_id, wann: x.datum, dringend: false })),
    ...d.todos.filter((x) => !x.erledigt && !x.parent_id && x.faellig_am).map((x) => ({ id: x.id, quelle: "todo" as const, art: "To-do", titel: x.titel, fachId: x.fach_id, wann: x.faellig_am, dringend: false })),
  ].sort((a, b) => new Date(a.wann as string).getTime() - new Date(b.wann as string).getTime());
  const ohneZeit: Eintrag[] = d.todos
    .filter((x) => !x.erledigt && !x.parent_id && !x.faellig_am)
    .sort((a, b) => (PRIO[a.prioritaet ?? "MITTEL"] ?? 1) - (PRIO[b.prioritaet ?? "MITTEL"] ?? 1))
    .map((x) => ({ id: x.id, quelle: "todo" as const, art: "To-do", titel: x.titel, fachId: x.fach_id, wann: null, dringend: false }));
  return [...mitZeit, ...ohneZeit].map((e) => ({ ...e, dringend: e.wann !== null && new Date(e.wann).getTime() - jetzt.getTime() < 2 * tag }));
}

/** Kurzer Text für die Spalte rechts: „heute 23:59“, „morgen 09:00“, „Fr“, „25.11.“, „überfällig“ */
export function wannKurz(iso: string | null, jetzt: Date): string {
  if (!iso) return "offen";
  const wann = new Date(iso);
  const tage = berlinTageZwischen(jetzt, wann);
  const uhr = berlinUhrzeit(wann);
  const zeit = uhr === "00:00" || uhr === "23:59" ? (uhr === "23:59" ? " 23:59" : "") : ` ${uhr}`;
  if (wann.getTime() < jetzt.getTime()) return "überfällig";
  if (tage === 0) return `heute${zeit}`;
  if (tage === 1) return `morgen${zeit}`;
  if (tage < 7) return new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }).format(wann).replace(".", "");
  const [, m, t] = berlinDatum(wann).split("-");
  return `${t}.${m}.`;
}

/** Ein Satz zur Lage über der Liste. `betont` sind die Wörter, die im Akzent stehen. */
export function lageSatz(eintraege: Eintrag[], jetzt: Date): { text: string; betont: string[] } {
  const erster = eintraege.find((e) => e.wann);
  if (!erster || !erster.wann) {
    return eintraege.length ? { text: "Keine Frist in Sicht. Zeit für das, was liegen geblieben ist.", betont: [] } : { text: "Gerade steht nichts an. Genieß den freien Kopf.", betont: [] };
  }
  const kurz = kuerzen(erster.titel, 36);
  const tage = berlinTageZwischen(jetzt, new Date(erster.wann));
  const woerter = kurz.split(/\s+/);
  if (new Date(erster.wann).getTime() < jetzt.getTime()) return { text: `${kurz} ist überfällig. Das zuerst.`, betont: woerter };
  if (tage === 0) return { text: `Heute zählt ${kurz}. Der Rest kann warten.`, betont: woerter.map((w, i) => (i === woerter.length - 1 ? `${w}.` : w)) };
  if (tage === 1) return { text: `Morgen ist ${kurz} dran. Heute ist Zeit zum Vorbereiten.`, betont: woerter };
  return { text: `Als Nächstes: ${kurz}. Bis dahin ist Luft.`, betont: woerter.map((w, i) => (i === woerter.length - 1 ? `${w}.` : w)) };
}

export function kuerzen(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max).replace(/\s+\S*$/, "");
  return `${schnitt || t.slice(0, max)} …`;
}

type Stunde = { id: string; tag: string; start_zeit: string; end_zeit: string; fach_id: string | null; raum: string | null };
export type Ereignis = { id: string; von: number; bis: number; titel: string; ort: string; fachId: string | null; art: "stunde" | "frist" | "pruefung" };
export type Wochentag = { datum: string; kurz: string; zahl: number; heute: boolean; ereignisse: Ereignis[] };

const TAG_KUERZEL = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const TAG_NAME = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const stundeVon = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + (m || 0) / 60;
};

/** Die laufende Woche mit Stundenplan, Fristen und Prüfungen je Tag (Stunden als Kommazahl, Berlin) */
export function woche(d: { stundenplan: Stunde[]; deadlines: Deadline[]; pruefungen: Pruefung[]; fachName: (id: string | null) => string | null }, jetzt: Date): Wochentag[] {
  const heute = berlinDatum(jetzt);
  return wochenTage(jetzt).map((datum, i) => {
    const ereignisse: Ereignis[] = [
      ...d.stundenplan
        .filter((s) => s.tag === TAG_KUERZEL[i])
        .map((s) => ({ id: s.id, von: stundeVon(s.start_zeit), bis: stundeVon(s.end_zeit), titel: d.fachName(s.fach_id) ?? "Veranstaltung", ort: s.raum ?? "", fachId: s.fach_id, art: "stunde" as const })),
      ...d.pruefungen
        .filter((p) => berlinDatum(new Date(p.datum)) === datum)
        .map((p) => {
          const v = stundeVon(berlinUhrzeit(new Date(p.datum)));
          return { id: p.id, von: v, bis: v + 1.5, titel: p.titel, ort: p.raum ? `Prüfung, ${p.raum}` : "Prüfung", fachId: p.fach_id, art: "pruefung" as const };
        }),
      ...d.deadlines
        .filter((f) => !f.erledigt && berlinDatum(new Date(f.faellig_am)) === datum)
        .map((f) => {
          const v = Math.min(stundeVon(berlinUhrzeit(new Date(f.faellig_am))), 22.5);
          return { id: f.id, von: v, bis: v + 0.5, titel: f.titel, ort: "Frist", fachId: f.fach_id, art: "frist" as const };
        }),
    ].sort((a, b) => a.von - b.von);
    return { datum, kurz: TAG_NAME[i], zahl: Number(datum.slice(8, 10)), heute: datum === heute, ereignisse };
  });
}

/** Lage im Zeitband 8 bis 23 Uhr in Prozent (links, Breite) */
export const BAND = { von: 8, bis: 23 };
export function bandLage(von: number, bis: number): { links: number; breite: number } {
  const span = BAND.bis - BAND.von;
  const a = Math.max(BAND.von, Math.min(BAND.bis, von));
  const b = Math.max(a, Math.min(BAND.bis, bis));
  return { links: Math.round(((a - BAND.von) / span) * 10000) / 100, breite: Math.round(((b - a) / span) * 10000) / 100 };
}

/** Dateityp als kurze Marke */
export function dateiTyp(mime: string, name: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("image/")) return "Bild";
  const endung = name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
  if (["ppt", "pptx", "key"].includes(endung)) return "Folien";
  if (["xls", "xlsx", "csv", "numbers"].includes(endung)) return "Tabelle";
  if (["doc", "docx", "odt", "pages", "txt", "md"].includes(endung)) return "Text";
  return endung ? endung.toUpperCase().slice(0, 4) : "Datei";
}

/** „vor 2 Std.“, „gestern“, „Mo“, „04.11.“ */
export function zuletztText(iso: string, jetzt: Date): string {
  const ms = jetzt.getTime() - new Date(iso).getTime();
  const tage = berlinTageZwischen(new Date(iso), jetzt);
  if (ms < 3_600_000) return `vor ${Math.max(1, Math.round(ms / 60_000))} Min.`;
  if (tage === 0) return `vor ${Math.round(ms / 3_600_000)} Std.`;
  if (tage === 1) return "gestern";
  if (tage < 7) return TAG_NAME[(new Date(iso).getUTCDay() + 6) % 7];
  const [, m, t] = berlinDatum(new Date(iso)).split("-");
  return `${t}.${m}.`;
}
