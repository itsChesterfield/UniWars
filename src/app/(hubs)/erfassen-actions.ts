"use server";

import { kiAnfrage, kiKonfiguriert } from "@/lib/ki/anbieter";
import { kiNutzer, textEingewilligt } from "@/lib/ki/server";
import { erfassenLesen, erfassenPrompt, type ErfassenErkannt } from "@/lib/ki/erfassen";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/**
 * Schnell erfassen: Was ist das? Kleines, schnelles Modell, nur mit KI-Einwilligung.
 * Ohne KI (oder bei Fehlern) null – dann gilt die einfache Erkennung im Browser.
 */
export async function erfassenErkennen(eingabe: string): Promise<ErfassenErkannt | null> {
  try {
    const satz = typeof eingabe === "string" ? eingabe.trim().slice(0, 300) : "";
    if (satz.length < 4 || !kiKonfiguriert()) return null;
    const { supabase, userId } = await kiNutzer();
    if (!(await textEingewilligt(supabase, userId))) return null;
    const { data: faecher } = await supabase.from("fach").select("name").eq("aktiv", true);
    const namen = (faecher ?? []).map((f) => f.name);
    const jetzt = new Date();
    const wochentag = WOCHENTAGE[new Date(`${berlinDatum(jetzt)}T12:00:00Z`).getUTCDay()];
    const p = erfassenPrompt(satz, namen, { datum: berlinDatum(jetzt), wochentag, uhrzeit: berlinUhrzeit(jetzt) });
    const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0.1, maxTokens: 200, timeoutMs: 8000 }, "schnell");
    return erfassenLesen(a.text, namen);
  } catch {
    return null;
  }
}
