"use server";

import { istErlaubteAnzahl, kartenParsen, kartenPromptBauen, MAX_NOTIZ_ZEICHEN, type Vorschlag } from "@/lib/ki/karten";
import { KiEingabe } from "@/lib/ki/fehler";
import { seitenPruefen } from "@/lib/ki/pdf-kontext";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";

/**
 * KI-03: Karteikarten aus PDF-Seiten. Den Seitentext liest der Browser aus (pdf.js);
 * der Server prüft, dass das PDF dem Nutzer gehört, und speichert NICHTS –
 * übernommen wird wie bei KI-01 über vorschlaegeUebernehmen.
 */
export async function pdfKartenVorschlagen(
  dateiId: string,
  seitenRoh: unknown,
  anzahl: number,
): Promise<KiErgebnis<{ karten: Vorschlag[]; gekuerzt: boolean; verbleibendHeute: number }>> {
  try {
    if (!istErlaubteAnzahl(anzahl)) throw new KiEingabe("Bitte wähle 5, 10 oder 15 Karten.");
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const seiten = seitenPruefen(seitenRoh, MAX_NOTIZ_ZEICHEN + 1000);
    if (!seiten) throw new KiEingabe("Zu viel Text auf einmal. Wähl weniger Seiten aus.");
    const { data: datei } = await supabase.from("datei").select("name, mime_typ").eq("id", dateiId).maybeSingle();
    if (!datei || datei.mime_typ !== "application/pdf") throw new KiEingabe("PDF nicht gefunden.");

    const text = seiten.map((s) => `[S. ${s.seite}]\n${s.text.trim()}`).join("\n\n");
    const prompt = kartenPromptBauen({ titel: datei.name, text, quelle: "pdf" }, anzahl);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "pdf_karteikarten",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 2000 },
      parsen: (a) => kartenParsen(a.text, anzahl),
    });
    return { ok: true, daten: { karten: ergebnis, gekuerzt: prompt.gekuerzt, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}
