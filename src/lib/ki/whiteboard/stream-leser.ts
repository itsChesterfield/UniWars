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

/**
 * Zieht vollstaendige JSON-Objekte `{...}` aus einem Textstrom, egal wie sie
 * verpackt sind: ein Objekt pro Zeile (NDJSON), ein JSON-Array, mehrzeilig
 * eingerueckt oder in einem Markdown-Codeblock. Alles ausserhalb der Objekte
 * (Klammern, Kommata, ```json, Leerzeilen) wird uebersprungen. So bleibt die
 * Zeichnung auch dann heil, wenn das Modell das strenge NDJSON-Format nicht
 * exakt trifft. Klammern und Anfuehrungszeichen innerhalb von Strings zaehlen
 * nicht mit (String-bewusst, inkl. Escapes).
 */
export class JsonObjektPuffer {
  private puffer = "";

  /** Nimmt ein Stueck Text und liefert die darin abgeschlossenen JSON-Objekte (roh). */
  schlucken(text: string): string[] {
    this.puffer += text;
    const objekte: string[] = [];
    let start = -1;
    let tiefe = 0;
    let imString = false;
    let escape = false;
    for (let i = 0; i < this.puffer.length; i++) {
      const c = this.puffer[i];
      if (imString) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') imString = false;
        continue;
      }
      if (c === '"') imString = true;
      else if (c === "{") {
        if (tiefe === 0) start = i;
        tiefe += 1;
      } else if (c === "}" && tiefe > 0) {
        tiefe -= 1;
        if (tiefe === 0 && start >= 0) {
          objekte.push(this.puffer.slice(start, i + 1));
          start = -1;
        }
      }
    }
    // Nur ein noch offenes Objekt behalten; fertige Objekte und Text dazwischen fallen weg.
    this.puffer = tiefe > 0 && start >= 0 ? this.puffer.slice(start) : "";
    return objekte;
  }

  /** Objekte werden beim Schlucken vollstaendig geliefert; es bleibt kein verwertbarer Rest. */
  rest(): string {
    return "";
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
