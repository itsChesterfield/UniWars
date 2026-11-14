"use server";

import { KiEingabe } from "@/lib/ki/fehler";
import {
  alternativenParsen,
  alternativenPrompt,
  feedbackEingabePruefen,
  feedbackParsen,
  feedbackPrompt,
  istEinzelnerSatz,
  type Kommentar,
} from "@/lib/ki/feedback";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";

/**
 * KI-06: Feedback zu Struktur und Formulierung. Den Text schickt der Editor (immer der
 * aktuelle Stand, auch vor dem automatischen Speichern); der Server prüft, dass das
 * Dokument dem Nutzer gehört. Feedback wird nicht gespeichert.
 */

async function eigenesDokument(supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"], id: string) {
  const { data } = await supabase.from("dokument").select("titel").eq("id", id).maybeSingle();
  if (!data) throw new KiEingabe("Dokument nicht gefunden.");
  return data;
}

export async function feedbackGeben(
  dokumentId: string,
  eingabe: { text: string; fokus: string[]; auswahl: boolean },
): Promise<KiErgebnis<{ kommentare: Kommentar[]; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const { text, fokus } = feedbackEingabePruefen(eingabe.text, eingabe.fokus);
    const dokument = await eigenesDokument(supabase, dokumentId);
    const prompt = feedbackPrompt(dokument.titel, text, fokus, Boolean(eingabe.auswahl));
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "feedback",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 2500 },
      zweck: "lang",
      parsen: (a) => feedbackParsen(a.text, fokus),
    });
    return { ok: true, daten: { kommentare: ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function alternativenVorschlagen(
  dokumentId: string,
  satz: string,
  kontext: string,
): Promise<KiErgebnis<{ alternativen: string[]; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    if (typeof satz !== "string" || !istEinzelnerSatz(satz)) throw new KiEingabe("Markiere genau einen Satz.");
    await eigenesDokument(supabase, dokumentId);
    const prompt = alternativenPrompt(satz, typeof kontext === "string" ? kontext : "");
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "feedback_satz",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.5, maxTokens: 500 },
      parsen: (a) => alternativenParsen(a.text, satz),
    });
    return { ok: true, daten: { alternativen: ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}
