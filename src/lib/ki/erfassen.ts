/**
 * Schnell erfassen: KI erkennt aus einem Satz, was es ist (Prüfung, Gruppenarbeit, Abgabe, Frist, Termin, To-do),
 * dazu Fach, Zeitpunkt und Raum. Ohne Next.js, testbar.
 */
import { alsObjekt, jsonLesen, text } from "./json.ts";

export type ErfassenArt = "PRUEFUNG" | "GRUPPENARBEIT" | "ABGABE" | "FRIST" | "TERMIN" | "TODO";

export type ErfassenErkannt = {
  art: ErfassenArt;
  /** Bereinigter Titel ohne Datum/Uhrzeit/Raum */
  titel: string;
  /** Name eines vorhandenen Fachs oder null */
  fach: string | null;
  /** YYYY-MM-DD oder YYYY-MM-DDTHH:MM (Ortszeit) */
  wann: string | null;
  raum: string | null;
};

export const ART_NAMEN: Record<ErfassenArt, string> = {
  PRUEFUNG: "Prüfung",
  GRUPPENARBEIT: "Gruppenarbeit",
  ABGABE: "Abgabe",
  FRIST: "Frist",
  TERMIN: "Termin",
  TODO: "To-do",
};

const ARTEN = Object.keys(ART_NAMEN) as ErfassenArt[];

export function erfassenPrompt(eingabe: string, faecher: string[], heute: { datum: string; wochentag: string; uhrzeit: string }): { system: string; nutzer: string } {
  return {
    system: [
      "Du ordnest Einträge von Studierenden ein. Gib NUR JSON zurück:",
      '{"art": "PRUEFUNG"|"GRUPPENARBEIT"|"ABGABE"|"FRIST"|"TERMIN"|"TODO", "titel": string, "fach": string|null, "wann": "YYYY-MM-DD"|"YYYY-MM-DDTHH:MM"|null, "raum": string|null}',
      "Arten: PRUEFUNG = Klausur, Prüfung, Test, mündliche Prüfung, Testat. GRUPPENARBEIT = Projekt/Arbeit mit anderen (Gruppe, Team, „mit X“). ABGABE = etwas einreichen (Hausarbeit, Übungsblatt, Protokoll, Bericht). FRIST = Verwaltung/Anmeldung/Bezahlung bis zu einem Datum (Rückmeldung, Prüfungsanmeldung, BAföG, Semesterbeitrag). TERMIN = Treffen zu fester Zeit (Sprechstunde, Meeting, Arzt). TODO = alles ohne Termin oder Kleinkram.",
      "titel: kurz, ohne Datum, Uhrzeit und Raum, aber mit dem Wesentlichen (z. B. „Klausur Statistik“).",
      "fach: genau ein Name aus der Liste der Fächer, wenn es offensichtlich passt (auch bei Abkürzungen), sonst null.",
      "wann: relative Angaben (morgen, Freitag, nächste Woche) vom heutigen Datum aus auflösen; ohne Uhrzeit nur das Datum; ohne Zeitangabe null.",
      "raum: nur wenn ein Raum/Ort genannt ist (z. B. „H1“, „WH C 445“), sonst null.",
    ].join("\n"),
    nutzer: `Heute: ${heute.wochentag}, ${heute.datum}, ${heute.uhrzeit} Uhr.\nFächer: ${faecher.length ? faecher.map((f) => `"${f}"`).join(", ") : "keine"}\nEintrag: ${eingabe}`,
  };
}

export function erfassenLesen(antwort: string, faecher: string[]): ErfassenErkannt | null {
  const o = alsObjekt(jsonLesen(antwort));
  const art = typeof o.art === "string" ? (o.art.toUpperCase() as ErfassenArt) : null;
  if (!art || !ARTEN.includes(art)) return null;
  const titel = text(o.titel, 160);
  const fachRoh = text(o.fach, 120);
  const fach = faecher.find((f) => f.toLowerCase() === fachRoh.toLowerCase()) ?? null;
  const wannRoh = text(o.wann, 20);
  const wann = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(wannRoh) ? wannRoh : null;
  return { art, titel, fach, wann, raum: text(o.raum, 60) || null };
}
