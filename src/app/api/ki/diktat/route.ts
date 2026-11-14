import { transkribieren } from "@/lib/ki/audio";
import { KiEingabe, KiKeineEinwilligung } from "@/lib/ki/fehler";
import { alsFehler, audioBuchen, audioMonatGenutzt, audioVoraussetzungen, kiNutzer, nutzungAbschliessen } from "@/lib/ki/server";
import { KI_STATUS } from "@/lib/ki/stream-antwort";
import { kiLimits } from "@/lib/ki/limits";

/**
 * KI-13: Diktieren (Sprache → Text). Die Aufnahme bleibt nur im Speicher (nicht im Storage).
 * Gebucht werden Audio-Sekunden VOR dem Aufruf; ist die Aufnahme laut Dienst länger, wird nachgebucht.
 */
export const maxDuration = 60;

/** Höchstens 2 Minuten (+ Puffer) und etwa 4 MB – passt in eine Vercel-Funktion */
const MAX_SEKUNDEN = 125;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let buchung: { nutzungId: string } | null = null;
  let supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"] | null = null;
  try {
    const nutzer = await kiNutzer();
    supabase = nutzer.supabase;
    await audioVoraussetzungen(supabase, nutzer.userId, "diktat");

    const form = await request.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) throw new KiEingabe("Die Aufnahme ist leer.");
    if (audio.size > MAX_BYTES) throw new KiEingabe("Die Aufnahme ist zu lang (höchstens 2 Minuten).");
    const sekunden = Math.ceil(Number(form?.get("sekunden")));
    if (!Number.isFinite(sekunden) || sekunden < 1) throw new KiEingabe("Die Aufnahme ist zu kurz.");
    if (sekunden > MAX_SEKUNDEN) throw new KiEingabe("Die Aufnahme ist zu lang (höchstens 2 Minuten).");
    const sprache = form?.get("sprache") === "en" ? "en" : "de";
    const endung = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";

    buchung = await audioBuchen(supabase, "diktat", sekunden);
    const ergebnis = await transkribieren(audio, sprache, { dateiname: `diktat.${endung}`, geschaetzteSekunden: sekunden });
    if (ergebnis.sekunden && Math.ceil(ergebnis.sekunden) > sekunden + 3) {
      const nach = await audioBuchen(supabase, "diktat", Math.ceil(ergebnis.sekunden) - sekunden, true).catch(() => null);
      if (nach) await nutzungAbschliessen(supabase, nach.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: true });
    }
    await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: true });
    const verbleibendSekunden = Math.max(0, kiLimits().audio.limit - (await audioMonatGenutzt(supabase)));
    return Response.json({ ok: true, daten: { text: ergebnis.text.trim(), verbleibendSekunden } });
  } catch (err) {
    if (buchung && supabase) await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
    const f = alsFehler(err);
    const art = err instanceof KiKeineEinwilligung ? err.art : undefined;
    return Response.json({ ...f, ...(art ? { art } : {}) }, { status: KI_STATUS[f.typ] ?? 500 });
  }
}
