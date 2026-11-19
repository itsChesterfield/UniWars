import type { Speiseplan } from "@/lib/mensa";
import type { Tables } from "@/lib/supabase/types";

/** Daten, die der Zentrale Hub (Bühne) vom Server bekommt */
export type FaelligeKarten = { anzahl: number; stapel: { id: string; name: string; anzahl: number }[] };

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
  /** Zeitpunkt der Anfrage auf dem Server (ISO): Mit ihm zeichnen Server und Browser den ersten Stand gleich */
  serverJetzt: string;
  /** Speiseplan der gewählten Mensa (null: keine gewählt oder gerade nicht erreichbar) */
  mensa?: Speiseplan | null;
  mensaGewaehlt?: boolean;
  /** z. B. „WiSe 2026/27 · Vorlesungswoche 6 von 17“ */
  semester?: string | null;
};
