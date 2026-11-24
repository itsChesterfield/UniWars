import { kiAnfrageStream } from "@/lib/ki/anbieter";
import { kiNutzer, nutzungAbschliessen, pflichttext, textBuchen, textHeuteGenutzt, textVoraussetzungen, type Supabase } from "@/lib/ki/server";
import { kiFehlerAntwort } from "@/lib/ki/stream-antwort";
import { ereignisLesen } from "@/lib/ki/whiteboard/protokoll";
import { MAX_FRAGE_ZEICHEN, whiteboardPromptBauen } from "@/lib/ki/whiteboard/prompt";
import { ZeilenPuffer } from "@/lib/ki/whiteboard/stream-leser";

/**
 * KI-16.3: Whiteboard-Modus. Baut den Prompt (Katalog, Koordinaten), bucht eine
 * Anfrage (KI-ALL-03), ruft Mistral streamend auf und gibt den Stream zeilenweise
 * an den Client weiter: jede fertige Zeile wird grob gegen das Protokoll geprueft,
 * nur gueltige (neu serialisierte) Zeilen gehen raus, kaputte werden verworfen und
 * gezaehlt (KI-ALL-09). Einwilligung (KI-ALL-02) setzt `textVoraussetzungen`
 * voraus; ohne sie kommt ein Fehler mit Status 403.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  let supabase: Supabase | null = null;
  let buchung: { nutzungId: string; limit: number } | null = null;
  try {
    const nutzer = await kiNutzer();
    supabase = nutzer.supabase;
    await textVoraussetzungen(supabase, nutzer.userId);

    const body = (await request.json().catch(() => ({}))) as { frage?: unknown; kontext?: unknown };
    const frage = pflichttext(body.frage, "Die Frage", MAX_FRAGE_ZEICHEN);
    const kontext = typeof body.kontext === "string" ? body.kontext : undefined;
    const prompt = whiteboardPromptBauen(frage, kontext);

    buchung = await textBuchen(supabase, "whiteboard");
    const nutzung = buchung;
    const aktiveSupabase = supabase;
    const verbleibend = Math.max(0, nutzung.limit - (await textHeuteGenutzt(aktiveSupabase)));

    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const it = kiAnfrageStream(
      { system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.5, maxTokens: 2000, signal: abbruch.signal },
      "stark",
    )[Symbol.asyncIterator]();

    // Erstes Ereignis abwarten: Fehler davor (z. B. ausgelastet) als klare JSON-Antwort.
    const erstes = await it.next();
    if (!erstes.done && erstes.value.typ === "fehler") throw erstes.value.fehler;

    const encoder = new TextEncoder();
    const puffer = new ZeilenPuffer();
    let tokens = { tokensEin: 0, tokensAus: 0 };
    let erfolgreich = false;
    let kaputt = 0;
    let abgeschlossen = false;

    const abschliessen = async () => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      if (kaputt) console.info("[ki] whiteboard: verworfene Zeilen", kaputt);
      await nutzungAbschliessen(aktiveSupabase, nutzung.nutzungId, { ...tokens, erfolgreich });
    };

    /** Gueltige Zeile neu serialisiert zurueckgeben, sonst null (und kaputt zaehlen). */
    const gueltig = (zeile: string): string | null => {
      if (!zeile.trim()) return null;
      const e = ereignisLesen(zeile);
      if (e) return JSON.stringify(e);
      kaputt += 1;
      return null;
    };

    let aktuell: typeof erstes | null = erstes;
    const strom = new ReadableStream<Uint8Array>({
      async pull(controller) {
        for (;;) {
          const r = aktuell ?? (await it.next());
          aktuell = null;
          if (r.done) {
            const rest = gueltig(puffer.rest());
            if (rest) controller.enqueue(encoder.encode(rest + "\n"));
            await abschliessen();
            controller.close();
            return;
          }
          const e = r.value;
          if (e.typ === "text") {
            const raus: string[] = [];
            for (const zeile of puffer.schlucken(e.text)) {
              const g = gueltig(zeile);
              if (g) raus.push(g);
            }
            if (raus.length) {
              controller.enqueue(encoder.encode(raus.join("\n") + "\n"));
              return;
            }
            continue;
          }
          if (e.typ === "fehler") {
            // Abbruch oder Fehler mitten im Stream: beenden, halbfertiger Stand bleibt stehen.
            await abschliessen();
            controller.close();
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
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-ki-verbleibend": String(verbleibend),
      },
    });
  } catch (err) {
    if (buchung && supabase) await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
    return kiFehlerAntwort(err);
  }
}
