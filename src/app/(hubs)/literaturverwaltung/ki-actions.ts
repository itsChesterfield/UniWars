"use server";

import { quelleErkennungParsen, quellePromptBauen, type QuellenErkennung } from "@/lib/ki/quelle";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";

/** KI-09: Quellenangabe aus eingefügtem Text erkennen. Füllt nur das Formular – gespeichert wird beim Klick auf Speichern. */
export async function quelleErkennen(eingabe: string): Promise<KiErgebnis<QuellenErkennung & { verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const text = typeof eingabe === "string" ? eingabe : "";
    const prompt = quellePromptBauen(text);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "quelle",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0, maxTokens: 600 },
      parsen: (a) => quelleErkennungParsen(a.text, text),
    });
    return { ok: true, daten: { ...ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}
