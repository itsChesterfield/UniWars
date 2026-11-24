/**
 * KI-16.4: Stream-Leser. Liest die NDJSON-Antwort zeilenweise, haelt eine
 * unfertige letzte Zeile im Puffer und verteilt nur gueltige Ereignisse. Kaputte
 * Zeilen werden uebersprungen und gezaehlt (Zahl, kein Inhalt, KI-ALL-09), damit
 * die Zeichnung bei einem Fehler nicht abstuerzt.
 *
 * Reiner Code (Web-Streams), damit Server und Client ihn gleich nutzen koennen.
 */
import { ereignisLesen, type WbEreignis } from "./protokoll.ts";

/** Sammelt Text und gibt vollstaendige Zeilen heraus; die letzte unfertige bleibt. */
export class ZeilenPuffer {
  private puffer = "";

  /** Nimmt ein Stueck Text und liefert die darin abgeschlossenen Zeilen. */
  schlucken(text: string): string[] {
    this.puffer += text;
    const zeilen = this.puffer.split("\n");
    this.puffer = zeilen.pop() ?? "";
    return zeilen;
  }

  /** Der verbliebene, noch nicht abgeschlossene Rest. */
  rest(): string {
    return this.puffer;
  }
}

export type StreamRueckmeldung = {
  /** Ein gueltiges Ereignis ist angekommen. */
  aufEreignis: (e: WbEreignis) => void;
  /** Gesamtzahl bisher verworfener kaputter Zeilen (optional). */
  aufKaputt?: (anzahl: number) => void;
};

/**
 * Liest einen Byte-Stream zeilenweise, wandelt jede Zeile in ein Ereignis und
 * meldet es. Bricht sauber ab, wenn das Signal ausloest (Stopp-Knopf): der
 * halbfertige Stand bleibt einfach stehen.
 */
export async function ereignisseAusStream(koerper: ReadableStream<Uint8Array>, rueck: StreamRueckmeldung, signal?: AbortSignal): Promise<void> {
  const leser = koerper.getReader();
  const dekoder = new TextDecoder();
  const puffer = new ZeilenPuffer();
  let kaputt = 0;

  const verarbeite = (zeile: string) => {
    if (!zeile.trim()) return;
    const e = ereignisLesen(zeile);
    if (e) {
      rueck.aufEreignis(e);
    } else {
      kaputt += 1;
      rueck.aufKaputt?.(kaputt);
    }
  };

  try {
    for (;;) {
      if (signal?.aborted) return;
      const { done, value } = await leser.read();
      if (done) break;
      for (const zeile of puffer.schlucken(dekoder.decode(value, { stream: true }))) verarbeite(zeile);
    }
    verarbeite(puffer.rest());
  } catch (fehler) {
    // Abbruch ueber das Signal ist kein Fehler: halbfertigen Stand stehen lassen.
    if (!signal?.aborted) throw fehler;
  } finally {
    leser.releaseLock();
  }
}

/** Baut aus NDJSON-Text einen Stream (fuer Tests und einen lokalen Mock-Stream). */
export function mockStream(ndjson: string, stueckGroesse = 24): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(ndjson);
  let i = 0;
  return new ReadableStream({
    pull(steuerung) {
      if (i >= bytes.length) {
        steuerung.close();
        return;
      }
      steuerung.enqueue(bytes.subarray(i, i + stueckGroesse));
      i += stueckGroesse;
    },
  });
}
