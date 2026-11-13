// Gemeinsamer Ablauf für gestreamte Text-KI-Antworten (KI-11, KI-03):
// Limit buchen → Stream starten → erstes Ereignis abwarten (Fehler davor als JSON)
// → Text als text/plain streamen → Nutzung am Ende oder bei Abbruch abschließen.
import "server-only";
import { kiAnfrageStream, type ModellZweck } from "@/lib/ki/anbieter";
import type { KiOptionen } from "@/lib/ki/anfrage";
import { alsFehler, nutzungAbschliessen, textBuchen, textHeuteGenutzt, type Supabase } from "@/lib/ki/server";

/** HTTP-Status für Fehler, die vor dem ersten Textstück passieren */
export const KI_STATUS: Record<string, number> = { limit: 429, ausgelastet: 503, einwilligung: 403, eingabe: 400, keine_daten: 422 };

export function kiFehlerAntwort(err: unknown): Response {
  const f = alsFehler(err);
  return Response.json(f, { status: KI_STATUS[f.typ] ?? 500 });
}

/**
 * Bucht eine Text-Anfrage und streamt die Antwort. Wirft nie: Fehler werden zur JSON-Antwort.
 * Voraussetzungen (Nutzer, Key, Einwilligung) und Eingaben prüft der Aufrufer vorher.
 */
export async function textStreamAntwort({
  request,
  supabase,
  funktion,
  optionen,
  zweck = "standard",
  zusatzHeader = {},
}: {
  request: Request;
  supabase: Supabase;
  funktion: string;
  optionen: Omit<KiOptionen, "signal">;
  zweck?: ModellZweck;
  zusatzHeader?: Record<string, string>;
}): Promise<Response> {
  let buchung: { nutzungId: string; limit: number } | null = null;
  try {
    buchung = await textBuchen(supabase, funktion);
    const nutzung = buchung;
    const verbleibend = Math.max(0, nutzung.limit - (await textHeuteGenutzt(supabase)));
    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const it = kiAnfrageStream({ ...optionen, signal: abbruch.signal }, zweck)[Symbol.asyncIterator]();

    // Erstes Ereignis abwarten: Fehler davor (z. B. ausgelastet) als klare JSON-Antwort
    const erstes = await it.next();
    if (!erstes.done && erstes.value.typ === "fehler") throw erstes.value.fehler;

    const encoder = new TextEncoder();
    let tokens = { tokensEin: 0, tokensAus: 0 };
    let erfolgreich = false;
    let abgeschlossen = false;
    const abschliessen = async () => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      await nutzungAbschliessen(supabase, nutzung.nutzungId, { ...tokens, erfolgreich });
    };

    let aktuell: typeof erstes | null = erstes;
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
        ...zusatzHeader,
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-ki-verbleibend": String(verbleibend),
      },
    });
  } catch (err) {
    if (buchung) await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
    return kiFehlerAntwort(err);
  }
}
