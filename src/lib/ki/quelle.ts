/**
 * KI-09: Quellenangabe aus eingefügtem Text erkennen – Prompt und Parser.
 * Grundsatz: Die KI erfindet keine Daten. Zusätzlich zur Prompt-Regel prüft der
 * Code jeden Wert gegen den eingefügten Text und verwirft, was dort nicht vorkommt.
 */
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { alsObjekt, jsonLesen, text } from "./json.ts";
import { einbetten, MATERIAL_REGEL } from "./material.ts";

export const MIN_QUELLE_ZEICHEN = 10;
export const MAX_QUELLE_ZEICHEN = 3000;

export type QuellenTypKi = "BUCH" | "ARTIKEL" | "WEBSEITE";
export type ErkannteFelder = {
  typ?: QuellenTypKi;
  autoren?: string;
  titel?: string;
  jahr?: number;
  verlag?: string;
  url?: string;
  abgerufenAm?: string;
  seiten?: string;
};
export type QuellenErkennung = { felder: ErkannteFelder; verworfen: (keyof ErkannteFelder)[] };

export function quellePromptBauen(eingabe: string) {
  const t = eingabe.trim();
  if (t.length < MIN_QUELLE_ZEICHEN) throw new KiEingabe("Füge eine vollständige Quellenangabe ein.");
  if (t.length > MAX_QUELLE_ZEICHEN) throw new KiEingabe(`Bitte füge nur eine Quellenangabe ein (höchstens ${MAX_QUELLE_ZEICHEN} Zeichen).`);
  const system = [
    "Du liest eine einzelne Quellenangabe (aus einem Literaturverzeichnis, PDF oder von einer Webseite) und trägst sie in Felder ein.",
    "Übernimm nur, was wörtlich in der Angabe steht. Erfinde nichts und ergänze nichts aus deinem Wissen. Fehlt ein Feld, setze null.",
    'Felder: typ ("BUCH", "ARTIKEL" oder "WEBSEITE"), autoren (Format "Nachname, Vorname; Nachname, Vorname"), titel, jahr (Zahl), verlag (bei Artikeln: Zeitschrift mit Jahrgang/Heft; bei Webseiten: Name der Website), url, abgerufen_am (Datum im Format JJJJ-MM-TT), seiten (z. B. "45–60").',
    MATERIAL_REGEL,
    'Antworte nur mit JSON: {"typ":…,"autoren":…,"titel":…,"jahr":…,"verlag":…,"url":…,"abgerufen_am":…,"seiten":…}',
  ].join("\n");
  return { system, nutzer: einbetten(t, "quelle") };
}

/** Kleinbuchstaben, nur Buchstaben/Ziffern – für den Abgleich mit dem Eingabetext. */
function norm(s: string): string {
  return s
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

const zahlen = (s: string) => s.match(/\d+/g) ?? [];

export function quelleErkennungParsen(antwort: string, eingabe: string): QuellenErkennung {
  const d = alsObjekt(jsonLesen(antwort));
  const quelle = norm(eingabe);
  const eingabeZahlen = new Set(zahlen(eingabe));
  const felder: ErkannteFelder = {};
  const verworfen: (keyof ErkannteFelder)[] = [];
  const kommtVor = (wert: string) => {
    const n = norm(wert);
    return n.length > 0 && quelle.includes(n);
  };

  /** Wert übernehmen, wenn er im Text steht – sonst als verworfen merken. */
  const setze = <K extends keyof ErkannteFelder>(feld: K, wert: ErkannteFelder[K], ok: boolean) => {
    if (ok) felder[feld] = wert;
    else verworfen.push(feld);
  };

  const titel = text(d.titel, 500);
  if (titel) setze("titel", titel, kommtVor(titel));

  const verlag = text(d.verlag, 300);
  if (verlag) setze("verlag", verlag, kommtVor(verlag));

  const url = text(d.url, 2000);
  if (url) setze("url", url, /^https?:\/\//i.test(url) && eingabe.toLowerCase().includes(url.toLowerCase().replace(/\/$/, "")));

  if (d.jahr !== null && d.jahr !== undefined && d.jahr !== "") {
    const jahr = typeof d.jahr === "number" ? d.jahr : Number(text(d.jahr, 10));
    setze("jahr", jahr, Number.isInteger(jahr) && jahr >= 1000 && jahr <= 2200 && eingabeZahlen.has(String(jahr)));
  }

  const seiten = text(d.seiten, 50);
  if (seiten) setze("seiten", seiten, zahlen(seiten).length > 0 && zahlen(seiten).every((z) => eingabeZahlen.has(z)));

  const datum = text(d.abgerufen_am, 10);
  if (datum) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
    const gueltig = Boolean(m) && !Number.isNaN(Date.parse(`${datum}T00:00:00Z`));
    // Jahr, Monat und Tag müssen (mit oder ohne führende Null) in der Eingabe stehen
    const vorhanden = Boolean(m) && [m![1], String(Number(m![2])), String(Number(m![3]))].every((z) => eingabeZahlen.has(z) || eingabeZahlen.has(z.padStart(2, "0")));
    setze("abgerufenAm", datum, gueltig && vorhanden);
  }

  // Autoren: nur die behalten, deren Nachname in der Eingabe steht
  const autorenRoh = text(d.autoren, 1000);
  if (autorenRoh) {
    const gefunden = autorenRoh
      .split(";")
      .map((a) => a.trim())
      .filter(Boolean)
      .filter((a) => kommtVor(a.includes(",") ? a.split(",")[0] : (a.split(/\s+/).at(-1) ?? a)));
    setze("autoren", gefunden.join("; "), gefunden.length > 0);
  }

  const typ = typeof d.typ === "string" ? d.typ.toUpperCase() : "";
  if (typ === "BUCH" || typ === "ARTIKEL" || typ === "WEBSEITE") felder.typ = typ;
  else if (felder.url && !felder.verlag) felder.typ = "WEBSEITE";

  const inhaltlich = (Object.keys(felder) as (keyof ErkannteFelder)[]).filter((k) => k !== "typ");
  if (inhaltlich.length === 0) throw new KiKeineDaten("In diesem Text wurde keine Quellenangabe erkannt.");
  return { felder, verworfen };
}
