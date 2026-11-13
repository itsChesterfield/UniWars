import { KiEingabe } from "@/lib/ki/fehler";
import { MAX_FRAGE_ZEICHEN, pdfFragePrompt, pdfZusammenfassungPrompt, seitenPruefen } from "@/lib/ki/pdf-kontext";
import { kiNutzer, textVoraussetzungen } from "@/lib/ki/server";
import { kiFehlerAntwort, textStreamAntwort } from "@/lib/ki/stream-antwort";

/**
 * KI-03: Fragen zum Skript / Seiten zusammenfassen – Antwort als Text-Stream mit Seitenangaben.
 * Den Seitentext liest der Browser mit pdf.js aus (der Server hat keinen PDF-Parser);
 * der Server prüft, dass das PDF dem Nutzer gehört (RLS), und begrenzt Seiten und Zeichen.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const dateiId = typeof body.dateiId === "string" ? body.dateiId : "";
    const modus = body.modus === "zusammenfassung" ? "zusammenfassung" : body.modus === "frage" ? "frage" : null;
    if (!modus) throw new KiEingabe("Unbekannte Anfrage.");
    const seiten = seitenPruefen(body.seiten);
    if (!seiten) throw new KiEingabe("Zu viel Text auf einmal. Wähl weniger Seiten aus.");
    if (!seiten.some((s) => s.text.trim().length > 0)) throw new KiEingabe("Auf diesen Seiten steht kein lesbarer Text.");

    const { data: datei } = await supabase.from("datei").select("name, mime_typ").eq("id", dateiId).maybeSingle();
    if (!datei || datei.mime_typ !== "application/pdf") throw new KiEingabe("PDF nicht gefunden.");

    let prompt: { system: string; nutzer: string };
    if (modus === "frage") {
      const frage = typeof body.frage === "string" ? body.frage.trim() : "";
      if (!frage) throw new KiEingabe("Bitte gib eine Frage ein.");
      if (frage.length > MAX_FRAGE_ZEICHEN) throw new KiEingabe(`Die Frage ist zu lang (höchstens ${MAX_FRAGE_ZEICHEN} Zeichen).`);
      prompt = pdfFragePrompt(datei.name, frage, seiten);
    } else {
      prompt = pdfZusammenfassungPrompt(datei.name, seiten);
    }

    return await textStreamAntwort({
      request,
      supabase,
      funktion: modus === "frage" ? "pdf_frage" : "pdf_zusammenfassung",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.2, maxTokens: modus === "frage" ? 700 : 900 },
    });
  } catch (err) {
    return kiFehlerAntwort(err);
  }
}
