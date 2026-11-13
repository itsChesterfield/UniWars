// Gemeinsamer Server-Ablauf aller Text-KI-Funktionen (KI-01 … KI-11):
// Nutzer → Key → Einwilligung → Limit buchen → Anfrage → prüfen → Nutzung abschließen.
// server-only: läuft nur in Server Actions / Route Handlern, immer mit dem
// Supabase-Client des Nutzers (RLS, KI-ALL-05) – nie mit einem Service-Role-Key.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { kiAnfrage, kiKonfiguriert, type ModellZweck } from "@/lib/ki/anbieter";
import type { KiAntwort, KiOptionen } from "@/lib/ki/anfrage";
import { KiEingabe, KiFehler, KiKeineEinwilligung, KiKonfiguration, KiLimitErreicht, type KiFehlerTyp } from "@/lib/ki/fehler";
import { kiLimits } from "@/lib/ki/limits";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";

import type { TextStatus } from "@/lib/ki/ergebnis";
export type { KiErgebnis, TextStatus } from "@/lib/ki/ergebnis";

const ALLGEMEINER_FEHLER = "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.";

export async function kiNutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new KiEingabe("Bitte melde dich erneut an.");
  return { supabase, userId: user.id };
}

export type Supabase = Awaited<ReturnType<typeof kiNutzer>>["supabase"];

export function pflichttext(wert: unknown, feld: string, max: number): string {
  const text = typeof wert === "string" ? wert.trim() : "";
  if (!text) throw new KiEingabe(`${feld} darf nicht leer sein.`);
  if (text.length > max) throw new KiEingabe(`${feld} ist zu lang.`);
  return text;
}

/** Fehler in einen Rückgabewert verwandeln – Details nur ins Server-Log (KI-ALL-08). */
export function alsFehler(err: unknown): { ok: false; fehler: string; typ: KiFehlerTyp } {
  if (err instanceof KiFehler) {
    if (err.typ === "technisch" || err.typ === "abgebrochen") console.error("[ki]", err.name, err.message);
    return { ok: false, fehler: err.nutzerMeldung, typ: err.typ };
  }
  console.error("[ki] unerwartet", err instanceof Error ? err.message : err);
  return { ok: false, fehler: ALLGEMEINER_FEHLER, typ: "technisch" };
}

/** Heute verbrauchte Text-Anfragen (nur das Text-Kontingent, nicht Chat/Audio). */
export async function textHeuteGenutzt(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from("ki_nutzung")
    .select("id", { count: "exact", head: true })
    .eq("kontingent", "text")
    .gte("erstellt_am", berlinMitternacht(berlinDatum()).toISOString());
  return count ?? 0;
}

export async function textEingewilligt(supabase: Supabase, userId: string): Promise<boolean> {
  const { data } = await supabase.from("settings").select("ki_einwilligung").eq("user_id", userId).maybeSingle();
  return Boolean(data?.ki_einwilligung);
}

/** Key vorhanden und Einwilligung erteilt? Wirft sonst die passende Meldung. */
export async function textVoraussetzungen(supabase: Supabase, userId: string): Promise<void> {
  if (!kiKonfiguriert()) throw new KiKonfiguration("MISTRAL_API_KEY fehlt");
  if (!(await textEingewilligt(supabase, userId))) throw new KiKeineEinwilligung();
}

export async function textStatus(supabase: Supabase, userId: string): Promise<TextStatus> {
  const [genutzt, eingewilligt] = await Promise.all([textHeuteGenutzt(supabase), textEingewilligt(supabase, userId)]);
  return { verfuegbar: kiKonfiguriert(), eingewilligt, genutzt, limit: kiLimits().text.limit };
}

/** Eine Text-Anfrage vom Tageslimit abbuchen (KI-ALL-03). */
export async function textBuchen(supabase: Supabase, funktion: string): Promise<{ nutzungId: string; limit: number }> {
  const limit = kiLimits().text.limit;
  const { data, error } = await supabase.rpc("ki_nutzung_buchen", { p_funktion: funktion, p_limit: limit });
  if (error) {
    if (error.message.includes("KI_LIMIT")) throw new KiLimitErreicht(limit);
    throw new Error(`Buchung fehlgeschlagen: ${error.message}`);
  }
  return { nutzungId: data, limit };
}

/** Tokens und Erfolg nachtragen. Fehlgeschlagene Anfragen bleiben gebucht. */
export async function nutzungAbschliessen(supabase: Supabase, nutzungId: string, t: { tokensEin: number; tokensAus: number; erfolgreich: boolean }) {
  const { error } = await supabase.rpc("ki_nutzung_abschliessen", {
    p_id: nutzungId,
    p_tokens_ein: t.tokensEin,
    p_tokens_aus: t.tokensAus,
    p_erfolgreich: t.erfolgreich,
  });
  if (error) console.error("[ki] abschliessen fehlgeschlagen", error.message);
}

/**
 * Bucht eine Anfrage, ruft das Modell auf und prüft die Antwort mit `parsen`.
 * Wirft `parsen` (z. B. "keine Karten"), zählt die Anfrage trotzdem.
 */
export async function textAnfrageAusfuehren<T>({
  supabase,
  funktion,
  optionen,
  zweck = "standard",
  parsen,
}: {
  supabase: Supabase;
  funktion: string;
  optionen: KiOptionen;
  zweck?: ModellZweck;
  parsen: (antwort: KiAntwort) => T;
}): Promise<{ ergebnis: T; verbleibend: number; limit: number }> {
  const { nutzungId, limit } = await textBuchen(supabase, funktion);
  let tokensEin = 0;
  let tokensAus = 0;
  let erfolgreich = false;
  try {
    const antwort = await kiAnfrage(optionen, zweck);
    tokensEin = antwort.tokensEin;
    tokensAus = antwort.tokensAus;
    const ergebnis = parsen(antwort);
    erfolgreich = true;
    const genutzt = await textHeuteGenutzt(supabase);
    return { ergebnis, verbleibend: Math.max(0, limit - genutzt), limit };
  } finally {
    await nutzungAbschliessen(supabase, nutzungId, { tokensEin, tokensAus, erfolgreich });
  }
}
