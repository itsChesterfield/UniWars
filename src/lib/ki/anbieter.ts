// KI-00: Einziger Einstieg für KI-Aufrufe im App-Code.
// "server-only" bricht den Build ab, falls diese Datei je in einem Client-Bundle landet –
// der API-Key darf den Server nie verlassen.
import "server-only";
import {
  kiAnfrageMit,
  kiAnfrageStreamMit,
  type KiAntwort,
  type KiKonfig,
  type KiOptionen,
  type StreamEreignis,
} from "@/lib/ki/anfrage";
import { kiLimits } from "@/lib/ki/limits";

const umgebung = (name: string) => process.env[name]?.trim() || undefined;

/** Wofür ein Modell gebraucht wird – jede Funktion kann per .env ein eigenes bekommen. */
export type ModellZweck = "standard" | "chat" | "lang";

/** Modell pro Zweck; fällt auf KI_MODELL zurück. */
export function kiModell(zweck: ModellZweck = "standard"): string {
  const standard = umgebung("KI_MODELL") ?? "mistral-small-latest";
  if (zweck === "chat") return umgebung("KI_MODELL_CHAT") ?? standard;
  if (zweck === "lang") return umgebung("KI_MODELL_LANG") ?? standard;
  return standard;
}

/** Anbieter, Modell und Key kommen ausschließlich aus der Umgebung (Anbieterwechsel = nur .env). */
export function kiKonfig(zweck: ModellZweck = "standard"): KiKonfig {
  return {
    basisUrl: umgebung("KI_BASIS_URL") ?? "https://api.mistral.ai/v1",
    modell: kiModell(zweck),
    apiKey: umgebung("MISTRAL_API_KEY"),
  };
}

/** Ist ein Key hinterlegt? (Für den Button-Zustand – sagt nichts darüber, ob er gültig ist.) */
export function kiKonfiguriert(): boolean {
  return Boolean(umgebung("MISTRAL_API_KEY"));
}

/** Tageslimit der Text-Funktionen (KI-01 … KI-11). */
export function kiTageslimit(): number {
  return kiLimits().text.limit;
}

export function kiAnfrage(optionen: KiOptionen, zweck: ModellZweck = "standard"): Promise<KiAntwort> {
  return kiAnfrageMit(kiKonfig(zweck), optionen);
}

export function kiAnfrageStream(optionen: KiOptionen, zweck: ModellZweck = "standard"): AsyncGenerator<StreamEreignis> {
  return kiAnfrageStreamMit(kiKonfig(zweck), optionen);
}
