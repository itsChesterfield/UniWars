// KI-00: Einziger Einstieg für KI-Aufrufe im App-Code.
// "server-only" bricht den Build ab, falls diese Datei je in einem Client-Bundle landet –
// der API-Key darf den Server nie verlassen.
import "server-only";
import { kiAnfrageMit, type KiAntwort, type KiKonfig, type KiOptionen } from "@/lib/ki/anfrage";

const umgebung = (name: string) => process.env[name]?.trim() || undefined;

/** Anbieter, Modell und Key kommen ausschließlich aus der Umgebung (Anbieterwechsel = nur .env). */
export function kiKonfig(): KiKonfig {
  return {
    basisUrl: umgebung("KI_BASIS_URL") ?? "https://api.mistral.ai/v1",
    modell: umgebung("KI_MODELL") ?? "mistral-small-latest",
    apiKey: umgebung("MISTRAL_API_KEY"),
  };
}

/** Ist ein Key hinterlegt? (Für den Button-Zustand – sagt nichts darüber, ob er gültig ist.) */
export function kiKonfiguriert(): boolean {
  return Boolean(umgebung("MISTRAL_API_KEY"));
}

export function kiTageslimit(): number {
  const wert = Number(umgebung("KI_TAGESLIMIT"));
  return Number.isInteger(wert) && wert > 0 && wert <= 1000 ? wert : 20;
}

export function kiAnfrage(optionen: KiOptionen): Promise<KiAntwort> {
  return kiAnfrageMit(kiKonfig(), optionen);
}
