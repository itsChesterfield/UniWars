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
  letzteRundeOhneWerkzeuge = false,
}: {
  rufen: ModellAufruf;
  /** Modell-Optionen ohne Nachrichten/Werkzeuge (System-Prompt gehört in `nachrichten`) */
  optionen: Omit<KiOptionen, "nachrichten" | "werkzeuge" | "system" | "nutzer">;
  nachrichten: Nachricht[];
  werkzeuge: Werkzeug[];
  maxRunden?: number;
  letzteRundeOhneWerkzeuge?: boolean;
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
      const angebot = letzteRundeOhneWerkzeuge && runde === maxRunden ? [] : definitionen;
      for await (const e of rufen({ ...optionen, nachrichten: verlauf, werkzeuge: angebot })) {
        if (e.typ === "text") {
          text += e.text;
          irgendwasGezeigt = true;
          yield e;
        } else if (e.typ === "werkzeuge") {
          if (angebot.length || !letzteRundeOhneWerkzeuge) aufrufe = e.aufrufe;
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

    // Werkzeuge einer Runde: Lesen gleichzeitig (schneller), alles andere der Reihe nach
    const vorbereitet = aufrufe.map((aufruf) => ({ aufruf, werkzeug: nachName.get(aufruf.name), argumente: argumenteLesen(aufruf.argumente) }));
    const gueltig = vorbereitet.filter((v) => v.werkzeug && v.argumente);
    if (gueltig.length) {
      const erster = gueltig[0].werkzeug!;
      const namen = new Set(gueltig.map((v) => v.werkzeug!.name));
      yield { typ: "status", text: namen.size > 1 ? "Schaue in deinen Daten nach …" : (erster.statusText ?? "Schaue in deinen Daten nach …"), werkzeug: erster.name };
    }
    type Ausgang = { ergebnis?: unknown; fehler?: string };
    const istLesen = (name: string) => /_(lesen|auflisten|status|suchen)$/.test(name);
    const ausfuehren = (v: (typeof vorbereitet)[number]): Promise<Ausgang> => {
      if (!v.werkzeug) return Promise.resolve({ fehler: `Unbekanntes Werkzeug: ${v.aufruf.name}` });
      if (!v.argumente) return Promise.resolve({ fehler: "Die Parameter waren kein gültiges JSON-Objekt." });
      return v.werkzeug.ausfuehren(v.argumente).then(
        (ergebnis) => ({ ergebnis }),
        // Das Modell bekommt den Fehler zurück und kann reagieren (z. B. andere Parameter)
        (err: unknown) => ({ fehler: err instanceof KiFehler ? err.nutzerMeldung : "Das Werkzeug ist fehlgeschlagen." }),
      );
    };
    let ergebnisse: Ausgang[];
    if (vorbereitet.every((v) => istLesen(v.aufruf.name))) {
      // Nur Lesen: alles gleichzeitig, identische Aufrufe nur einmal
      const laufend = new Map<string, Promise<Ausgang>>();
      ergebnisse = await Promise.all(
        vorbereitet.map((v) => {
          const schluessel = `${v.aufruf.name}:${v.aufruf.argumente}`;
          let p = laufend.get(schluessel);
          if (!p) {
            p = ausfuehren(v);
            laufend.set(schluessel, p);
          }
          return p;
        }),
      );
    } else {
      // Anlegen, Ändern …: der Reihe nach (Reihenfolge und Grenzen zählen)
      ergebnisse = [];
      for (const v of vorbereitet) ergebnisse.push(await ausfuehren(v));
    }
    for (const [i, v] of vorbereitet.entries()) {
      const { ergebnis, fehler } = ergebnisse[i];
      yield { typ: "werkzeug", name: v.aufruf.name, argumente: v.argumente ?? {}, ergebnis, fehler };
      const nachricht: Nachricht = {
        role: "tool",
        tool_call_id: v.aufruf.id,
        name: v.aufruf.name,
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
