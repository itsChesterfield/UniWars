/**
 * Zahl und Lage-Satz für den Kopf der Bereiche (Didi, 20.11.: alle Bereiche in der Sprache des Hubs).
 * Reine Rechnung ohne React und ohne Supabase-Import, damit Tests sie prüfen.
 */
import { alsNaechstes, kuerzen, uhrAus, wannKurz, woche } from "./hub-buehne.ts";
import { berlinDatum, berlinUhrzeit } from "./zeit.ts";
import { wochenTage } from "./hub-texte.ts";

export type Kopf = { zahl: number | string | null; einheit: string; lage: { text: string; betont: string[] } | null };

type Deadline = Parameters<typeof alsNaechstes>[0]["deadlines"][number];
type Todo = Parameters<typeof alsNaechstes>[0]["todos"][number];
type Pruefung = Parameters<typeof alsNaechstes>[0]["pruefungen"][number];
type Stunde = Parameters<typeof woche>[0]["stundenplan"][number];

const woerter = (t: string) => t.split(/\s+/).filter(Boolean);

/** Satz mit einem betonten Namen am Ende, z. B. „Zuletzt bearbeitet: Hausarbeit.“ */
function mitName(vorne: string, name: string, hinten = "."): { text: string; betont: string[] } {
  const kurz = kuerzen(name, 36);
  // Betont werden die Wörter so, wie sie im Satz stehen: Satzzeichen hängen am letzten Wort
  const anhang = hinten.startsWith(" ") ? "" : hinten.split(" ")[0];
  const w = woerter(kurz);
  const betont = w.map((x, i) => (i === w.length - 1 ? `${x}${anhang}` : x));
  return { text: `${vorne} ${kurz}${hinten}`, betont };
}

export function kopfAufgaben(d: { deadlines: Deadline[]; todos: Todo[]; pruefungen: Pruefung[] }, jetzt: Date): Kopf {
  const liste = alsNaechstes(d, jetzt);
  const erster = liste.find((e) => e.wann);
  return {
    zahl: liste.length,
    einheit: "offen",
    lage: erster ? mitName("Zuerst:", erster.titel, `, ${wannKurz(erster.wann, jetzt)}.`) : liste.length ? { text: "Keine Frist in Sicht.", betont: [] } : { text: "Alles erledigt.", betont: [] },
  };
}

export function kopfTermine(
  d: { stundenplan: Stunde[]; deadlines: Deadline[]; pruefungen: Pruefung[]; fachName: (id: string | null) => string | null },
  jetzt: Date,
): Kopf {
  const heute = woche(d, jetzt).find((t) => t.heute)?.ereignisse ?? [];
  const jetztH = Number(berlinUhrzeit(jetzt).slice(0, 2)) + Number(berlinUhrzeit(jetzt).slice(3, 5)) / 60;
  const naechster = heute.find((e) => (e.art === "frist" ? e.von >= jetztH - 0.01 : e.bis > jetztH));
  const einheit = "heute";
  if (!naechster) return { zahl: heute.length, einheit, lage: { text: heute.length ? "Für heute ist alles vorbei." : "Heute ist frei.", betont: [] } };
  const uhr = naechster.uhr ?? uhrAus(naechster.von);
  const laeuft = naechster.art !== "frist" && naechster.von <= jetztH;
  return { zahl: heute.length, einheit, lage: mitName(laeuft ? "Gerade:" : "Als Nächstes:", naechster.titel, laeuft ? "." : ` um ${uhr}.`) };
}

export function kopfNoten(schnitt: number | null, anzahl: number): Kopf {
  if (schnitt === null || !Number.isFinite(schnitt)) return { zahl: anzahl || null, einheit: anzahl === 1 ? "Note eingetragen" : "Noten eingetragen", lage: null };
  return {
    zahl: schnitt.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    einheit: `Gesamtnote aus ${anzahl} ${anzahl === 1 ? "Note" : "Noten"}`,
    lage: null,
  };
}

export function kopfFortschritt(streak: number, minutenWoche: number): Kopf {
  const h = Math.floor(minutenWoche / 60);
  const m = minutenWoche % 60;
  const zeit = h ? `${h} h ${m} min` : `${m} min`;
  return {
    zahl: streak,
    einheit: streak === 1 ? "Tag in Folge" : "Tage in Folge",
    lage: minutenWoche > 0 ? { text: `Diese Woche ${zeit} gelernt.`, betont: woerter(zeit) } : { text: "Diese Woche noch keine Lernzeit.", betont: [] },
  };
}

/** Listen-Bereiche (Notizen, Dokumente, Tabellen …): Anzahl und das zuletzt Bearbeitete */
export function kopfListe(eintraege: { titel: string | null; geaendert: string | null }[], ohneTitel: string, einheit: [string, string]): Kopf {
  const neuester = [...eintraege].filter((e) => e.geaendert).sort((a, b) => (b.geaendert as string).localeCompare(a.geaendert as string))[0];
  // Keine große Zahl: „1 Tabelle“ sagt nichts (Aufgabe 4, A1). Groß steht dann der Name des Bereichs.
  return {
    zahl: null,
    einheit: eintraege.length === 1 ? einheit[0] : einheit[1],
    lage: neuester ? mitName("Zuletzt bearbeitet:", neuester.titel?.trim() || ohneTitel) : null,
  };
}

/** Lernminuten der laufenden Woche (Montag bis Sonntag, Berlin) */
export function minutenDieseWoche(sessions: { start: string; dauer_minuten: number }[], jetzt: Date): number {
  const tage = new Set(wochenTage(jetzt));
  return sessions.filter((x) => tage.has(berlinDatum(new Date(x.start)))).reduce((n, x) => n + x.dauer_minuten, 0);
}

/** Karteikarten: der Stapel mit den meisten fälligen Karten, sonst „Alles wiederholt.“ */
export function kartenLage(stapel: { name: string; faellig: number }[]): { text: string; betont: string[] } {
  const top = [...stapel].sort((a, b) => b.faellig - a.faellig)[0];
  if (!top || top.faellig === 0) return { text: "Alles wiederholt. Zeit für Neues.", betont: [] };
  return mitName("Heute dran:", top.name);
}

/** PDF Reader: zuletzt gelesenes PDF mit Seite */
export function pdfLage(zuletzt: { name: string; letzteSeite: number | null } | undefined): { text: string; betont: string[] } | null {
  if (!zuletzt) return null;
  const name = zuletzt.name.replace(/\.pdf$/i, "");
  return zuletzt.letzteSeite && zuletzt.letzteSeite > 1 ? mitName("Weiterlesen:", name, `, Seite ${zuletzt.letzteSeite}.`) : mitName("Zuletzt geöffnet:", name);
}
