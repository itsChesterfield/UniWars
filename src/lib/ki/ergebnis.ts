import type { KiFehlerTyp } from "@/lib/ki/fehler";

/**
 * Rückgabewert aller KI-Server-Actions. Erwartbare Fehler kommen als Wert (nicht als
 * Exception), damit die deutsche Meldung auch im Produktivbetrieb im UI ankommt.
 */
export type KiErgebnis<T> = { ok: true; daten: T } | { ok: false; fehler: string; typ: KiFehlerTyp };

/** Status der Text-Funktionen für Dialoge (Key, Einwilligung, Tageslimit) */
export type TextStatus = { verfuegbar: boolean; eingewilligt: boolean; genutzt: number; limit: number };

/** Für Analytics zusammengefasste Fehlertypen (KI-ALL-09) */
export type KiFehlerTypAnalytics = "limit" | "ausgelastet" | "technisch" | "keine_daten";

export function fehlerTypFuerAnalytics(typ: KiFehlerTyp): KiFehlerTypAnalytics | null {
  if (typ === "limit" || typ === "ausgelastet") return typ;
  if (typ === "keine_karten" || typ === "keine_daten") return "keine_daten";
  if (typ === "technisch" || typ === "abgebrochen" || typ === "zu_komplex") return "technisch";
  return null; // Eingabe-/Einwilligungsfehler sind keine KI-Fehler
}
