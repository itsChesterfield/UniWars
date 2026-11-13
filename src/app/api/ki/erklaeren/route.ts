import { kiAnfrageStream } from "@/lib/ki/anbieter";
import { erklaerungPromptBauen } from "@/lib/ki/erklaeren";
import { KiEingabe } from "@/lib/ki/fehler";
import { alsFehler, kiNutzer, nutzungAbschliessen, textBuchen, textHeuteGenutzt, textVoraussetzungen } from "@/lib/ki/server";

/**
 * KI-11: "Erklär mir das" – Antwort als Text-Stream. Die Erklärung wird nicht gespeichert.
 * Fehler vor dem ersten Textstück kommen als JSON ({ ok:false, fehler, typ }) mit Fehlerstatus.
 */
export const maxDuration = 60;

const STATUS: Record<string, number> = { limit: 429, ausgelastet: 503, einwilligung: 403, eingabe: 400, keine_daten: 422 };

export async function POST(request: Request) {
  let buchung: { nutzungId: string; limit: number } | null = null;
  let supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"] | null = null;
  try {
    const nutzer = await kiNutzer();
    supabase = nutzer.supabase;
    await textVoraussetzungen(supabase, nutzer.userId);

    const body = (await request.json().catch(() => ({}))) as { karteId?: unknown };
    const karteId = typeof body.karteId === "string" ? body.karteId : "";
    // Karte und Notiz lädt der Server selbst (RLS) – kein Inhalt vom Client
    const { data: karte } = await supabase.from("kk_karte").select("vorderseite, rueckseite, quelle_notiz_id").eq("id", karteId).maybeSingle();
    if (!karte) throw new KiEingabe("Karte nicht gefunden.");
    const { data: notiz } = karte.quelle_notiz_id
      ? await supabase.from("notiz").select("titel, inhalt").eq("id", karte.quelle_notiz_id).maybeSingle()
      : { data: null };
    const prompt = erklaerungPromptBauen(karte, notiz);

    buchung = await textBuchen(supabase, "erklaeren");
    const verbleibend = Math.max(0, buchung.limit - (await textHeuteGenutzt(supabase)));
    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const it = kiAnfrageStream({ system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.4, maxTokens: 600, signal: abbruch.signal })[Symbol.asyncIterator]();

    // Erstes Ereignis abwarten: Fehler davor (z. B. ausgelastet) als klare JSON-Antwort
    const erstes = await it.next();
    const db = supabase;
    const nutzung = buchung;
    const encoder = new TextEncoder();
    let tokens = { tokensEin: 0, tokensAus: 0 };
    let erfolgreich = false;
    let abgeschlossen = false;
    const abschliessen = async () => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      await nutzungAbschliessen(db, nutzung.nutzungId, { ...tokens, erfolgreich });
    };

    let aktuell: IteratorResult<Awaited<ReturnType<typeof it.next>>["value"]> | null = erstes;
    const strom = new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const r = aktuell ?? (await it.next());
          aktuell = null;
          if (r.done) {
            await abschliessen();
            controller.close();
            return;
          }
          const e = r.value;
          if (e.typ === "text") {
            controller.enqueue(encoder.encode(e.text));
            return;
          }
          if (e.typ === "fehler") {
            controller.enqueue(encoder.encode(`\n\n_(${e.fehler.nutzerMeldung})_`));
            return;
          }
          if (e.typ === "ende") {
            tokens = { tokensEin: e.tokensEin, tokensAus: e.tokensAus };
            erfolgreich = true;
          }
        }
      },
      async cancel() {
        abbruch.abort();
        await it.return?.(undefined);
        await abschliessen();
      },
    });

    return new Response(strom, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-ki-verbleibend": String(verbleibend),
      },
    });
  } catch (err) {
    if (buchung && supabase) await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
    const f = alsFehler(err);
    return Response.json(f, { status: STATUS[f.typ] ?? 500 });
  }
}
