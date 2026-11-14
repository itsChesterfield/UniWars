// KI-12 (8.4): Werkzeuge für VORSCHLÄGE. Sie speichern nichts, sondern erzeugen Aktionskarten.
// Erst der Klick des Nutzers ruft die bestehende Server Action auf (KI-ALL-01).
import "server-only";
import type { Werkzeug } from "@/lib/ki/agent";
import type { Supabase } from "@/lib/ki/server";
import { anzahlFaellig } from "@/lib/karteikarten/wiederholung";
import { DEADLINE_TYPEN, karteBauen, karteKurz, PRIORITAETEN, type Aktionskarte, type FachRef, type KarteInhalt, type StapelRef } from "@/lib/ki/assistent";

/** Fächer und Stapel des Nutzers für die Prüfung der Vorschläge (einmal pro Nachricht geladen). */
export async function umfeldLaden(supabase: Supabase): Promise<{ faecher: FachRef[]; stapel: StapelRef[] }> {
  const [{ data: faecher }, { data: stapel }, { data: karten }] = await Promise.all([
    supabase.from("fach").select("id, name").eq("aktiv", true),
    supabase.from("kk_stapel").select("id, name, fach_id"),
    supabase.from("kk_karte").select("stapel_id, naechste_abfrage"),
  ]);
  return {
    faecher: faecher ?? [],
    stapel: (stapel ?? []).map((s) => ({ ...s, faellig: anzahlFaellig((karten ?? []).filter((k) => k.stapel_id === s.id)) })),
  };
}

const FACH = { fach: { type: "string", description: "Fach: Name oder ID (optional)" } };

const DEFINITIONEN: { typ: KarteInhalt["typ"]; name: string; beschreibung: string; parameter: Record<string, unknown> }[] = [
  {
    typ: "deadline",
    name: "deadline_vorschlagen",
    beschreibung: "Schlägt eine Deadline vor (Abgabe, Frist, Termin). Speichert nichts – der Nutzer bestätigt per Klick.",
    parameter: {
      type: "object",
      properties: {
        titel: { type: "string" },
        faellig_am: { type: "string", description: "Wie vom Nutzer gesagt, z. B. 'Freitag', 'morgen 14 Uhr', '24.12.' oder YYYY-MM-DD" },
        typ: { type: "string", enum: [...DEADLINE_TYPEN] },
        ...FACH,
      },
      required: ["titel", "faellig_am"],
    },
  },
  {
    typ: "todo",
    name: "todo_vorschlagen",
    beschreibung: "Schlägt ein To-do vor. Speichert nichts.",
    parameter: { type: "object", properties: { titel: { type: "string" }, prioritaet: { type: "string", enum: [...PRIORITAETEN] }, ...FACH }, required: ["titel"] },
  },
  {
    typ: "karteikarten",
    name: "karteikarten_vorschlagen",
    beschreibung: "Schlägt Karteikarten vor (höchstens 20). Speichert nichts.",
    parameter: {
      type: "object",
      properties: {
        karten: {
          type: "array",
          items: { type: "object", properties: { vorderseite: { type: "string" }, rueckseite: { type: "string" } }, required: ["vorderseite", "rueckseite"] },
        },
        stapel: { type: "string", description: "Vorhandener Stapel (Name oder ID) oder Name für einen neuen Stapel" },
        ...FACH,
      },
      required: ["karten"],
    },
  },
  {
    typ: "lernsession",
    name: "lernsession_vorschlagen",
    beschreibung: "Schlägt eine Fokus-Session in der Work Station vor (öffnet sie mit vorausgewähltem Fach).",
    parameter: { type: "object", properties: { minuten: { type: "integer" }, ...FACH } },
  },
  {
    typ: "stapel_lernen",
    name: "stapel_lernen_vorschlagen",
    beschreibung: "Schlägt vor, einen Karteikarten-Stapel jetzt zu lernen (öffnet den Lernmodus).",
    parameter: { type: "object", properties: { stapel: { type: "string", description: "Name oder ID des Stapels" } }, required: ["stapel"] },
  },
  {
    typ: "notiz",
    name: "notiz_vorschlagen",
    beschreibung: "Schlägt eine neue Notiz vor (Titel und Inhalt in Markdown). Speichert nichts.",
    parameter: { type: "object", properties: { titel: { type: "string" }, inhalt: { type: "string" }, ...FACH }, required: ["titel", "inhalt"] },
  },
];

/** Vorschlagswerkzeuge; erzeugte Karten landen in `karten` (für Stream und Speicherung). */
export function vorschlagswerkzeuge(
  umfeld: { faecher: FachRef[]; stapel: StapelRef[]; jetzt: Date },
  karten: Aktionskarte[],
): Werkzeug[] {
  return DEFINITIONEN.map((d) => ({
    name: d.name,
    beschreibung: d.beschreibung,
    parameter: d.parameter,
    statusText: "Bereite einen Vorschlag vor …",
    ausfuehren: async (args) => {
      if (karten.length >= 8) return { fehler: "Zu viele Vorschläge in einer Antwort." };
      const inhalt = karteBauen(d.typ, args, umfeld);
      const karte = { id: crypto.randomUUID(), status: "offen", ...inhalt } as Aktionskarte;
      karten.push(karte);
      return { vorschlag: karteKurz(inhalt), hinweis: "Der Nutzer sieht dazu eine Karte und entscheidet selbst. Es wurde nichts gespeichert." };
    },
  }));
}
