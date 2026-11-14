/**
 * KI-05: Lernplan-Agent – macht von selbst höchstens 3 Vorschläge für heute.
 * Die Daten liefern dieselben Lese-Werkzeuge wie beim Assistenten (8.3); das Modell
 * bekommt sie gesammelt und antwortet nur über die Vorschlagswerkzeuge (8.4).
 */
import type { Werkzeug } from "./agent.ts";
import type { Aktionskarte } from "./assistent.ts";
import { einbetten, MATERIAL_REGEL } from "./material.ts";

export const MAX_VORSCHLAEGE = 3;
/** Nur diese Vorschläge passen zu „heute lernen“ */
export const LERNPLAN_WERKZEUGE = ["stapel_lernen_vorschlagen", "lernsession_vorschlagen", "todo_vorschlagen"] as const;

export type Tagesvorschlag = { grund: string; karte: Aktionskarte };

/** Datenauszug aus den Lese-Werkzeugen (Ergebnisse unverändert, nur gebündelt). */
export type Lagebild = {
  faecher: unknown[];
  pruefungen: unknown[];
  deadlines: unknown[];
  /** offene To-dos – damit nichts doppelt vorgeschlagen wird */
  todos_offen: unknown[];
  stapel: { karten?: number; heute_faellig?: number }[];
  stundenplan_heute: unknown[];
  lernzeit_7_tage: { minuten_gesamt?: number; pro_fach?: Record<string, number> };
};

/** Ohne Fächer, Prüfungen, Deadlines und Karten gibt es nichts vorzuschlagen → kein KI-Aufruf. */
export function hatDaten(l: Lagebild): boolean {
  return l.faecher.length > 0 || l.pruefungen.length > 0 || l.deadlines.length > 0 || l.stapel.some((s) => (s.karten ?? 0) > 0);
}

export function lernplanPrompt(lagebild: Lagebild, heute: string): { system: string; nutzer: string } {
  const system = [
    "Du bist der Lernplaner in der App UniWars. Schlag dem Studierenden für HEUTE höchstens 3 konkrete, kleine nächste Schritte vor.",
    "Nutze dafür ausschließlich die Vorschlagswerkzeuge – jeder Vorschlag ein Werkzeugaufruf. Gib in `grund` einen kurzen Satz an, warum gerade jetzt (mit Zahlen aus den Daten, z. B. „Mathe-Klausur in 9 Tagen, 42 Karten fällig“).",
    "Priorität: 1) Prüfungen in den nächsten 21 Tagen mit fälligen Karten oder wenig Lernzeit, 2) offene Deadlines in den nächsten 7 Tagen, 3) Fächer mit wenig Lernzeit in den letzten 7 Tagen.",
    "Erfinde keine Prüfungen, Deadlines, Stapel oder Zahlen. Wenn nichts Sinnvolles ansteht, mach weniger oder keine Vorschläge.",
    "Schlag nichts doppelt vor und nichts, was es schon gibt (z. B. kein To-do, das schon in `todos_offen` steht, und keins für eine erledigte Deadline).",
    "Schreib nach den Werkzeugaufrufen keinen weiteren Text.",
    MATERIAL_REGEL,
  ].join("\n");
  const nutzer = `Heute ist ${heute}. Daten des Nutzers:\n${einbetten(JSON.stringify(lagebild, null, 1), "quelle", { art: "lagebild" })}`;
  return { system, nutzer };
}

/**
 * Vorschlagswerkzeug um den Parameter `grund` erweitern und höchstens 3 Karten zulassen.
 * Der Grund landet in `gruende` (Karten-ID → Satz).
 */
export function mitGrund(werkzeug: Werkzeug, karten: Aktionskarte[], gruende: Map<string, string>): Werkzeug {
  const parameter = werkzeug.parameter as { properties?: Record<string, unknown>; required?: string[] };
  return {
    ...werkzeug,
    parameter: {
      ...parameter,
      type: "object",
      properties: { ...(parameter.properties ?? {}), grund: { type: "string", description: "Ein kurzer Satz: warum gerade heute" } },
      required: [...(parameter.required ?? []), "grund"],
    },
    ausfuehren: async (args) => {
      if (karten.length >= MAX_VORSCHLAEGE) return { fehler: `Höchstens ${MAX_VORSCHLAEGE} Vorschläge.` };
      const vorher = karten.length;
      const ergebnis = await werkzeug.ausfuehren(args);
      if (karten.length > vorher) {
        const grund = typeof args.grund === "string" ? args.grund.replace(/\s+/g, " ").trim().slice(0, 200) : "";
        gruende.set(karten[karten.length - 1].id, grund);
      }
      return ergebnis;
    },
  };
}

/** Gespeicherte Vorschläge lesen (robust gegen alte/fremde Formen). */
export function tagesvorschlaegeLesen(roh: unknown): Tagesvorschlag[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((v): v is Tagesvorschlag => {
      const o = v as Partial<Tagesvorschlag> | null;
      return Boolean(o && typeof o.grund === "string" && o.karte && typeof o.karte.id === "string" && typeof o.karte.typ === "string");
    })
    .slice(0, MAX_VORSCHLAEGE);
}
