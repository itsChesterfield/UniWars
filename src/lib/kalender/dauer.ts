import type { Enums } from "@/lib/supabase/types";

export const STANDARD_DAUER: Record<Enums<"deadline_typ"> | "PRUEFUNG", number> = {
  PRUEFUNG: 90,
  TERMIN: 60,
  GRUPPENARBEIT: 60,
  ABGABE: 15,
  FRIST: 15,
  SONSTIGE: 15,
};

export const DAUER_OPTIONEN = [30, 45, 60, 90, 120, 180, 240];
