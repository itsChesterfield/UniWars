import type { Speiseplan } from "@/lib/mensa";
import type { Tables } from "@/lib/supabase/types";
import type { Darstellung } from "@/lib/personalisierung";

/** Daten, die der Zentrale Hub (Bühne) vom Server bekommt */
export type FaelligeKarten = { anzahl: number; stapel: { id: string; name: string; anzahl: number; fachId: string | null }[] };

/** Wissensstand pro Thema (Studio), für die Klausurphase */
export type ThemaStand = { fach_id: string | null; thema: string; beherrschung: number; fehlerbild: string | null };

export type HubDaten = {
  name: string;
  faecher: Tables<"fach">[];
  deadlines: Tables<"deadline">[];
  todos: Tables<"todo">[];
  pruefungen: Tables<"pruefung">[];
  stundenplan: Tables<"stundenplan_eintrag">[];
  lernSessions: Tables<"lern_session">[];
  streak: number;
  karten: FaelligeKarten;
  themen: ThemaStand[];
  /** Persönliche Darstellung (hier für den Zustand der Klausurphase) */
  darstellung: Darstellung;
  /** Zeitpunkt der Anfrage auf dem Server (ISO): Mit ihm zeichnen Server und Browser den ersten Stand gleich */
  serverJetzt: string;
  /** Speiseplan der gewählten Mensa (null: keine gewählt oder gerade nicht erreichbar) */
  mensa?: Speiseplan | null;
  mensaGewaehlt?: boolean;
  /** z. B. „WiSe 2026/27 · Vorlesungswoche 6 von 17“ */
  semester?: string | null;
};
