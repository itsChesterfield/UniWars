/**
 * Zentraler Hub als Bühne (Entscheidung Didi, 19.11.; Idee A vom 19.11. abends): vier Kapitel, die sich beim Scrollen ablösen.
 * Hier nur Rechnung ohne React und ohne Supabase-Import, damit Tests sie prüfen.
 */
import { berlinDatum, berlinTageZwischen, berlinUhrzeit } from "./zeit.ts";
import { wochenTage } from "./hub-texte.ts";

export const SZENEN = [
  { id: "heute", name: "Heute" },
  { id: "woche", name: "Diese Woche" },
  { id: "mensa", name: "Mensa" },
  { id: "zuletzt", name: "Zuletzt geöffnet" },
] as const;
export type SzeneId = (typeof SZENEN)[number]["id"];

/** Welche Szene der Scrollstand zeigt (Szenenhöhe in px) */
export function szeneBeiScroll(scrollTop: number, hoehe: number, anzahl: number): number {
  if (hoehe <= 0) return 0;
  return Math.max(0, Math.min(anzahl - 1, Math.round(scrollTop / hoehe)));
}

type Deadline = {
  id: string;
  titel: string;
  faellig_am: string;
  erledigt: boolean;
  fach_id: string | null;
  typ?: string | null;
  /** Unteraufgaben sind Fristen mit Verweis auf ihre Aufgabe */
  todo_id?: string | null;
  pruefung_id?: string | null;
  parent_deadline_id?: string | null;
};
type Todo = { id: string; titel: string; erledigt: boolean; parent_id: string | null; fach_id: string | null; faellig_am: string | null; prioritaet?: string | null };
type Pruefung = { id: string; titel: string; datum: string; fach_id: string | null; status?: string | null; raum?: string | null };

export type Eintrag = {
  id: string;
  quelle: "deadline" | "todo" | "pruefung";
  art: string;
  titel: string;
  fachId: string | null;
  wann: string | null;
  dringend: boolean;
  /** Titel der Aufgabe, Prüfung oder Frist, zu der diese Unteraufgabe gehört */
  teilVon: string | null;
};

/** Zu welcher Aufgabe gehört eine Frist? null, wenn sie selbst eine Aufgabe ist. */
export function oberaufgabe(
  f: Pick<Deadline, "todo_id" | "pruefung_id" | "parent_deadline_id">,
  d: { deadlines: { id: string; titel: string }[]; todos: { id: string; titel: string }[]; pruefungen: { id: string; titel: string }[] },
): string | null {
  if (f.parent_deadline_id) return d.deadlines.find((x) => x.id === f.parent_deadline_id)?.titel ?? "einer Frist";
  if (f.todo_id) return d.todos.find((x) => x.id === f.todo_id)?.titel ?? "einem To-do";
  if (f.pruefung_id) return d.pruefungen.find((x) => x.id === f.pruefung_id)?.titel ?? "einer Prüfung";
  return null;
}

const PRIO: Record<string, number> = { HOCH: 0, MITTEL: 1, NIEDRIG: 2 };

/** Offene Fristen, Prüfungen und To-dos, nach Zeit; To-dos ohne Datum nach Priorität dahinter */
export function alsNaechstes(d: { deadlines: Deadline[]; todos: Todo[]; pruefungen: Pruefung[] }, jetzt: Date): Eintrag[] {
  const tag = 86_400_000;
  const mitZeit: Eintrag[] = [
    ...d.deadlines.filter((x) => !x.erledigt).map((x) => ({ id: x.id, quelle: "deadline" as const, art: x.typ === "ABGABE" ? "Abgabe" : "Frist", titel: x.titel, fachId: x.fach_id, wann: x.faellig_am, dringend: false, teilVon: oberaufgabe(x, d) })),
    ...d.pruefungen
      .filter((x) => (x.status ?? "ANSTEHEND") === "ANSTEHEND" && new Date(x.datum).getTime() >= jetzt.getTime() - tag)
      .map((x) => ({ id: x.id, quelle: "pruefung" as const, art: "Prüfung", titel: x.titel, fachId: x.fach_id, wann: x.datum, dringend: false, teilVon: null })),
    ...d.todos.filter((x) => !x.erledigt && !x.parent_id && x.faellig_am).map((x) => ({ id: x.id, quelle: "todo" as const, art: "To-do", titel: x.titel, fachId: x.fach_id, wann: x.faellig_am, dringend: false, teilVon: null })),
  ].sort((a, b) => new Date(a.wann as string).getTime() - new Date(b.wann as string).getTime());
  const ohneZeit: Eintrag[] = d.todos
    .filter((x) => !x.erledigt && !x.parent_id && !x.faellig_am)
    .sort((a, b) => (PRIO[a.prioritaet ?? "MITTEL"] ?? 1) - (PRIO[b.prioritaet ?? "MITTEL"] ?? 1))
    .map((x) => ({ id: x.id, quelle: "todo" as const, art: "To-do", titel: x.titel, fachId: x.fach_id, wann: null, dringend: false, teilVon: null }));
  return [...mitZeit, ...ohneZeit].map((e) => ({ ...e, dringend: e.wann !== null && new Date(e.wann).getTime() - jetzt.getTime() < 2 * tag }));
}

/** Kurzer Text für die Spalte rechts: „heute 23:59“, „morgen 09:00“, „Fr 11:00“, „25.11.“, „überfällig“ */
export function wannKurz(iso: string | null, jetzt: Date): string {
  if (!iso) return "offen";
  const wann = new Date(iso);
  const tage = berlinTageZwischen(jetzt, wann);
  const uhr = berlinUhrzeit(wann);
  const zeit = uhr === "00:00" || uhr === "23:59" ? (uhr === "23:59" ? " 23:59" : "") : ` ${uhr}`;
  if (wann.getTime() < jetzt.getTime()) return "überfällig";
  if (tage === 0) return `heute${zeit}`;
  if (tage === 1) return `morgen${zeit}`;
  if (tage < 7) return `${new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }).format(wann).replace(".", "")}${zeit}`;
  const [, m, t] = berlinDatum(wann).split("-");
  return `${t}.${m}.`;
}

/**
 * Die Lage in einem großen Satz (`text`) und einer ruhigen Zeile darunter (`unter`).
 * `betont` sind die Wörter, die im Akzent stehen.
 */
export function lageSatz(eintraege: Eintrag[], jetzt: Date): { text: string; betont: string[]; unter: string } {
  const erster = eintraege.find((e) => e.wann);
  const danach = eintraege.filter((e) => e !== erster).length;
  const rest = danach === 0 ? "Sonst ist nichts offen." : danach === 1 ? "Danach wartet noch eine Sache." : `Danach warten noch ${danach} Sachen.`;
  if (!erster || !erster.wann) {
    return eintraege.length
      ? { text: "Keine Frist in Sicht.", betont: [], unter: "Zeit für das, was liegen geblieben ist." }
      : { text: "Gerade steht nichts an.", betont: [], unter: "Genieß den freien Kopf." };
  }
  const kurz = kuerzen(erster.titel, 36);
  const wann = new Date(erster.wann);
  const tage = berlinTageZwischen(jetzt, wann);
  const woerter = kurz.split(/\s+/);
  const mitPunkt = woerter.map((w, i) => (i === woerter.length - 1 ? `${w}.` : w));
  const uhr = berlinUhrzeit(wann);
  const teil = erster.teilVon ? `Teil von „${kuerzen(erster.teilVon, 40)}“. ` : "";
  if (wann.getTime() < jetzt.getTime()) return { text: `${kurz} ist überfällig.`, betont: woerter, unter: `${teil}Das zuerst. ${rest}` };
  if (tage === 0) return { text: `Heute zählt ${kurz}.`, betont: mitPunkt, unter: `${teil}Fällig um ${uhr}. ${rest}` };
  if (tage === 1) return { text: `Morgen ist ${kurz} dran.`, betont: woerter, unter: `${teil}Heute ist Zeit zum Vorbereiten. ${rest}` };
  return { text: `Als Nächstes: ${kurz}.`, betont: mitPunkt, unter: `${teil}Bis dahin ist Luft. ${rest}` };
}

/** Führt eine Aufgabe zum Lernen? Dann direkt zum passenden Stapel oder zu den Karteikarten. */
export function lernZiel(titel: string, stapel: { id: string; name: string }[]): string | null {
  const t = titel.toLowerCase();
  const passend = stapel.find((s) => s.name.trim().length > 2 && t.includes(s.name.trim().toLowerCase()));
  if (passend) return `/karteikarten/${passend.id}/lernen`;
  return /karteikart|karten\b|abfrag|wiederhol|vokabel|lernen\b/.test(t) ? "/karteikarten" : null;
}

/** Vorschlag von Studio, wie die Liste ihn zeigt */
export type HubVorschlag = { id: string; titel: string; grund: string; href?: string; frage?: string };

/**
 * Höchstens zwei Vorschläge von Studio für „Als Nächstes“. Fristen und „offene To-dos“ stehen schon in der
 * Liste, die fallen weg. Gedankenstriche aus den Texten werden zu Kommas.
 */
export function hubVorschlaege(v: { id: string; titel: string; grund: string; href?: string; frage?: string }[]): HubVorschlag[] {
  return v
    .filter((x) => !x.id.startsWith("deadline-") && x.id !== "todos" && (x.href || x.frage))
    .slice(0, 2)
    .map((x) => ({ id: `studio-${x.id}`, titel: x.titel, grund: x.grund.replace(/\s+[–—]\s+/g, ", "), href: x.href, frage: x.frage }));
}

/** Liste mit Vorschlägen dazwischen: nach dem ersten und nach dem dritten Eintrag */
export function mischen<A, B>(liste: A[], vorschlaege: B[], max = 5): (A | B)[] {
  const out: (A | B)[] = [];
  const v = [...vorschlaege];
  liste.forEach((e, i) => {
    out.push(e);
    if ((i === 0 || i === 2) && v.length) out.push(v.shift() as B);
  });
  out.push(...v);
  return out.slice(0, max);
}

/** Termine, die sich überschneiden, bekommen eigene Spuren. `mindest` ist die sichtbare Mindestdauer in Stunden. */
export function spuren<T extends { von: number; bis: number }>(liste: T[], mindest = 1.25): (T & { spur: number })[] {
  const enden: number[] = [];
  return [...liste]
    .sort((a, b) => a.von - b.von)
    .map((e) => {
      let s = enden.findIndex((x) => x <= e.von + 0.001);
      if (s < 0) {
        s = enden.length;
        enden.push(0);
      }
      enden[s] = Math.max(e.bis, e.von + mindest);
      return { ...e, spur: s };
    });
}

/** „08:15“ aus 8.25 */
export function uhrAus(h: number): string {
  const min = Math.round(h * 60);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function kuerzen(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max).replace(/\s+\S*$/, "");
  return `${schnitt || t.slice(0, max)} …`;
}

type Stunde = { id: string; tag: string; start_zeit: string; end_zeit: string; fach_id: string | null; raum: string | null };
/** `uhr` ist die echte Uhrzeit, wenn `von` für die Anzeige verschoben wurde (Frist kurz vor Mitternacht) */
export type Ereignis = { id: string; von: number; bis: number; titel: string; ort: string; fachId: string | null; art: "stunde" | "frist" | "pruefung"; uhr?: string };
export type Wochentag = { datum: string; kurz: string; zahl: number; heute: boolean; ereignisse: Ereignis[] };

const TAG_KUERZEL = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const TAG_NAME = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const stundeVon = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + (m || 0) / 60;
};

/** Die laufende Woche mit Stundenplan, Fristen und Prüfungen je Tag (Stunden als Kommazahl, Berlin) */
export function woche(
  d: { stundenplan: Stunde[]; deadlines: Deadline[]; pruefungen: Pruefung[]; todos?: { id: string; titel: string }[]; fachName: (id: string | null) => string | null },
  jetzt: Date,
): Wochentag[] {
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
          return { id: p.id, von: v, bis: v + 1.5, titel: p.titel, ort: p.raum ?? "", fachId: p.fach_id, art: "pruefung" as const };
        }),
      ...d.deadlines
        .filter((f) => !f.erledigt && berlinDatum(new Date(f.faellig_am)) === datum)
        .map((f) => {
          const uhr = berlinUhrzeit(new Date(f.faellig_am));
          const v = Math.min(stundeVon(uhr), 22.5);
          const teil = oberaufgabe(f, { deadlines: d.deadlines, todos: d.todos ?? [], pruefungen: d.pruefungen });
          return { id: f.id, von: v, bis: v + 0.5, titel: f.titel, ort: teil ? `Teil von ${teil}` : "", fachId: f.fach_id, art: "frist" as const, uhr };
        }),
    ].sort((a, b) => a.von - b.von);
    return { datum, kurz: TAG_NAME[i], zahl: Number(datum.slice(8, 10)), heute: datum === heute, ereignisse };
  });
}

/** Zeile über dem Zeitband: „Freitag, 20. November, 2 Einträge“ (Datum als JJJJ-MM-TT, Berliner Kalendertag) */
export function tagZeile(datum: string, anzahl: number): string {
  const tag = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${datum}T12:00:00Z`));
  return `${tag}, ${anzahl === 0 ? "frei" : anzahl === 1 ? "1 Eintrag" : `${anzahl} Einträge`}`;
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
