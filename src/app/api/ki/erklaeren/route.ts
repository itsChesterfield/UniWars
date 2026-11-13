import { erklaerungPromptBauen } from "@/lib/ki/erklaeren";
import { KiEingabe } from "@/lib/ki/fehler";
import { kiNutzer, textVoraussetzungen } from "@/lib/ki/server";
import { kiFehlerAntwort, textStreamAntwort } from "@/lib/ki/stream-antwort";

/**
 * KI-11: "Erklär mir das" – Antwort als Text-Stream. Die Erklärung wird nicht gespeichert.
 * Fehler vor dem ersten Textstück kommen als JSON ({ ok:false, fehler, typ }) mit Fehlerstatus.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const body = (await request.json().catch(() => ({}))) as { karteId?: unknown };
    const karteId = typeof body.karteId === "string" ? body.karteId : "";
    // Karte und Notiz lädt der Server selbst (RLS) – kein Inhalt vom Client
    const { data: karte } = await supabase.from("kk_karte").select("vorderseite, rueckseite, quelle_notiz_id").eq("id", karteId).maybeSingle();
    if (!karte) throw new KiEingabe("Karte nicht gefunden.");
    const { data: notiz } = karte.quelle_notiz_id
      ? await supabase.from("notiz").select("titel, inhalt").eq("id", karte.quelle_notiz_id).maybeSingle()
      : { data: null };
    const prompt = erklaerungPromptBauen(karte, notiz);

    return await textStreamAntwort({
      request,
      supabase,
      funktion: "erklaeren",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.4, maxTokens: 600 },
    });
  } catch (err) {
    return kiFehlerAntwort(err);
  }
}
