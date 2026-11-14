import { sprechen } from "@/lib/ki/audio";
import { MAX_TTS_ZEICHEN } from "@/lib/ki/audio-kern";
import { KiEingabe, KiKeineEinwilligung } from "@/lib/ki/fehler";
import { alsFehler, audioVoraussetzungen, kiNutzer, nutzungAbschliessen, ttsBuchen, ttsMonatGenutzt } from "@/lib/ki/server";
import { KI_STATUS } from "@/lib/ki/stream-antwort";
import { kiLimits } from "@/lib/ki/limits";

/**
 * KI-14: Vorlesen (Text → Sprache). Der Browser schickt den bereits aufbereiteten Text
 * in kurzen Stücken (erstes Stück ≈ 1 Satz → schneller Start) und spielt sie nacheinander ab.
 * Gebucht werden die Zeichen des Stücks. Die Antwort ist MP3, gestreamt durchgereicht.
 */
export const maxDuration = 60;

const MAX_STUECK = Math.min(MAX_TTS_ZEICHEN, 800);

export async function POST(request: Request) {
  let buchung: { nutzungId: string } | null = null;
  let supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"] | null = null;
  try {
    const nutzer = await kiNutzer();
    supabase = nutzer.supabase;
    await audioVoraussetzungen(supabase, nutzer.userId, "vorlesen");

    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
    if (!text) throw new KiEingabe("Es gibt nichts vorzulesen.");
    if (text.length > MAX_STUECK) throw new KiEingabe("Der Abschnitt ist zu lang zum Vorlesen.");

    buchung = await ttsBuchen(supabase, text.length);
    const nutzung = buchung;
    const db = supabase;
    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const { audio, mime } = await sprechen(text, { format: "mp3", signal: abbruch.signal });
    const verbleibend = Math.max(0, kiLimits().tts.limit - (await ttsMonatGenutzt(db)));

    // Nutzung abschließen, sobald der Audiostrom durch ist (oder abgebrochen wurde)
    let abgeschlossen = false;
    const abschliessen = async (erfolgreich: boolean) => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      await nutzungAbschliessen(db, nutzung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich });
    };
    const leser = audio.getReader();
    const strom = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await leser.read();
          if (done) {
            await abschliessen(true);
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (err) {
          await abschliessen(false);
          controller.error(err);
        }
      },
      async cancel() {
        abbruch.abort();
        await leser.cancel().catch(() => undefined);
        await abschliessen(false);
      },
    });
    return new Response(strom, { headers: { "content-type": mime, "cache-control": "no-store", "x-ki-verbleibend": String(verbleibend) } });
  } catch (err) {
    if (buchung && supabase) await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
    const f = alsFehler(err);
    const art = err instanceof KiKeineEinwilligung ? err.art : undefined;
    return Response.json({ ...f, ...(art ? { art } : {}) }, { status: KI_STATUS[f.typ] ?? 500 });
  }
}
