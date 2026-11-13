/**
 * KI-00b: Tool-Schleife. Modell aufrufen → gewünschte Werkzeuge ausführen →
 * Ergebnisse als `tool`-Nachrichten zurückgeben → erneut aufrufen. Höchstens
 * `maxRunden` Runden pro Nutzerfrage. Werkzeuge LESEN oder erzeugen VORSCHLÄGE –
 * gespeichert wird nie hier, sondern erst nach Klick des Nutzers (KI-ALL-01).
 */
import type { KiOptionen, Nachricht, StreamEreignis, WerkzeugAufruf, WerkzeugDefinition } from "./anfrage.ts";
import { KiFehler, KiNichtVerfuegbar, KiZuKomplex } from "./fehler.ts";

export type Werkzeug = WerkzeugDefinition & {
  /** Zeile für die UI, während das Werkzeug läuft, z. B. "Schaue in deinen Stundenplan …" */
  statusText?: string;
  ausfuehren: (argumente: Record<string, unknown>) => Promise<unknown>;
};

export type AgentEreignis =
  | { typ: "status"; text: string; werkzeug: string }
  | { typ: "text"; text: string }
  | { typ: "werkzeug"; name: string; argumente: Record<string, unknown>; ergebnis: unknown; fehler?: string }
  | { typ: "fehler"; fehler: KiFehler }
  | {
      typ: "ende";
      tokensEin: number;
      tokensAus: number;
      geschaetzt: boolean;
      runden: number;
      /** Alle in diesem Lauf neu entstandenen Nachrichten (Assistent + Werkzeug), zum Speichern */
      neueNachrichten: Nachricht[];
    };

/** Ruft das Modell (gestreamt) auf – in der App kiAnfrageStream, in Tests ein Mock. */
export type ModellAufruf = (optionen: KiOptionen) => AsyncIterable<StreamEreignis>;

export const MAX_RUNDEN = 5;
/** Werkzeugergebnisse werden für das Modell auf diese Länge gekürzt */
export const MAX_ERGEBNIS_ZEICHEN = 12_000;

function argumenteLesen(roh: string): Record<string, unknown> | null {
  try {
    const wert: unknown = JSON.parse(roh || "{}");
    return wert && typeof wert === "object" && !Array.isArray(wert) ? (wert as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function ergebnisAlsText(ergebnis: unknown): string {
  const text = JSON.stringify(ergebnis ?? null) ?? "null";
  return text.length > MAX_ERGEBNIS_ZEICHEN ? `${text.slice(0, MAX_ERGEBNIS_ZEICHEN)}… (gekürzt)` : text;
}

export async function* agentLauf({
  rufen,
  optionen,
  nachrichten,
  werkzeuge,
  maxRunden = MAX_RUNDEN,
}: {
  rufen: ModellAufruf;
  /** Modell-Optionen ohne Nachrichten/Werkzeuge (System-Prompt gehört in `nachrichten`) */
  optionen: Omit<KiOptionen, "nachrichten" | "werkzeuge" | "system" | "nutzer">;
  nachrichten: Nachricht[];
  werkzeuge: Werkzeug[];
  maxRunden?: number;
}): AsyncGenerator<AgentEreignis> {
  const verlauf = [...nachrichten];
  const neue: Nachricht[] = [];
  const nachName = new Map(werkzeuge.map((w) => [w.name, w]));
  const definitionen: WerkzeugDefinition[] = werkzeuge.map(({ name, beschreibung, parameter }) => ({ name, beschreibung, parameter }));
  let tokensEin = 0;
  let tokensAus = 0;
  let geschaetzt = false;
  let runde = 0;
  let irgendwasGezeigt = false;

  const ende = (): AgentEreignis => ({ typ: "ende", tokensEin, tokensAus, geschaetzt, runden: runde, neueNachrichten: neue });

  while (runde < maxRunden) {
    runde++;
    let text = "";
    let aufrufe: WerkzeugAufruf[] = [];
    let abgebrochen = false;
    try {
      for await (const e of rufen({ ...optionen, nachrichten: verlauf, werkzeuge: definitionen })) {
        if (e.typ === "text") {
          text += e.text;
          irgendwasGezeigt = true;
          yield e;
        } else if (e.typ === "werkzeuge") {
          aufrufe = e.aufrufe;
        } else if (e.typ === "fehler") {
          abgebrochen = true;
          yield e;
        } else if (e.typ === "ende") {
          tokensEin += e.tokensEin;
          tokensAus += e.tokensAus;
          geschaetzt ||= e.geschaetzt;
        }
      }
    } catch (err) {
      // Vor der ersten sichtbaren Ausgabe: Fehler normal werfen (z. B. 429 → klare Meldung)
      if (!irgendwasGezeigt) throw err;
      yield { typ: "fehler", fehler: err instanceof KiFehler ? err : new KiNichtVerfuegbar(String(err)) };
      abgebrochen = true;
    }

    if (abgebrochen) {
      if (text) neue.push({ role: "assistant", content: text });
      yield ende();
      return;
    }

    if (aufrufe.length === 0) {
      neue.push({ role: "assistant", content: text });
      yield ende();
      return;
    }

    const assistent: Nachricht = { role: "assistant", content: text, tool_calls: aufrufe };
    verlauf.push(assistent);
    neue.push(assistent);

    for (const aufruf of aufrufe) {
      const werkzeug = nachName.get(aufruf.name);
      const argumente = argumenteLesen(aufruf.argumente);
      let ergebnis: unknown;
      let fehler: string | undefined;
      if (!werkzeug) {
        fehler = `Unbekanntes Werkzeug: ${aufruf.name}`;
      } else if (!argumente) {
        fehler = "Die Parameter waren kein gültiges JSON-Objekt.";
      } else {
        yield { typ: "status", text: werkzeug.statusText ?? "Schaue in deinen Daten nach …", werkzeug: werkzeug.name };
        try {
          ergebnis = await werkzeug.ausfuehren(argumente);
        } catch (err) {
          // Das Modell bekommt den Fehler zurück und kann reagieren (z. B. andere Parameter)
          fehler = err instanceof KiFehler ? err.nutzerMeldung : "Das Werkzeug ist fehlgeschlagen.";
        }
      }
      yield { typ: "werkzeug", name: aufruf.name, argumente: argumente ?? {}, ergebnis, fehler };
      const nachricht: Nachricht = {
        role: "tool",
        tool_call_id: aufruf.id,
        name: aufruf.name,
        content: ergebnisAlsText(fehler ? { fehler } : ergebnis),
      };
      verlauf.push(nachricht);
      neue.push(nachricht);
    }
  }

  // Nach maxRunden immer noch Werkzeugwünsche → abbrechen
  yield { typ: "fehler", fehler: new KiZuKomplex() };
  yield ende();
}
