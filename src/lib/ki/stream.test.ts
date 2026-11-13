import { test } from "node:test";
import assert from "node:assert/strict";
import { kiAnfrageMit, kiAnfrageStreamMit, nachrichtenBauen, sseDaten, type KiKonfig, type StreamEreignis } from "./anfrage.ts";
import { agentLauf, type AgentEreignis, type ModellAufruf, type Werkzeug } from "./agent.ts";
import { KiAbgebrochen, KiAusgelastet, KiZuKomplex } from "./fehler.ts";

const KONFIG: KiKonfig = { basisUrl: "https://api.example.test/v1", modell: "test-modell", apiKey: "geheim" };
const leise = { log: () => {}, timeoutMs: 200 };

/** Baut einen SSE-Strom aus Textstücken (bewusst an beliebigen Stellen zerschnitten). */
function strom(stuecke: string[], abbrechenNach?: number): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (abbrechenNach !== undefined && i === abbrechenNach) {
        c.error(new Error("Verbindung weg"));
        return;
      }
      if (i >= stuecke.length) {
        c.close();
        return;
      }
      c.enqueue(enc.encode(stuecke[i++]));
    },
  });
}

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const delta = (content: string) => sse({ choices: [{ delta: { content } }] });

async function sammeln<T>(it: AsyncIterable<T>): Promise<T[]> {
  const liste: T[] = [];
  for await (const e of it) liste.push(e);
  return liste;
}

function fetchMit(antwort: () => Response) {
  const bodies: Record<string, unknown>[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return antwort();
  }) as typeof fetch;
  return { f, bodies };
}

// ---------------------------------------------------------------------------
// SSE-Zerlegung und Streaming
// ---------------------------------------------------------------------------

test("SSE: Zeilen über Stückgrenzen hinweg, Kommentare, [DONE]", async () => {
  const text = `${delta("Hal")}${delta("lo")}: kommentar\n\ndata: [DONE]\n\n${delta("nie")}`;
  const zerschnitten = [text.slice(0, 7), text.slice(7, 40), text.slice(40)];
  const daten = await sammeln(sseDaten(strom(zerschnitten)));
  assert.equal(daten.length, 2);
  assert.deepEqual((daten as { choices: { delta: { content: string } }[] }[]).map((d) => d.choices[0].delta.content), ["Hal", "lo"]);
});

test("Stream: Text in Stücken, usage aus dem letzten Block, stream:true gesendet", async () => {
  const { f, bodies } = fetchMit(
    () =>
      new Response(
        strom([delta("Guten "), delta("Morgen"), sse({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 3 } }), "data: [DONE]\n\n"]),
        { status: 200 },
      ),
  );
  const ereignisse = await sammeln(kiAnfrageStreamMit(KONFIG, { system: "S", nutzer: "N", maxTokens: 50, temperatur: 0.2 }, { ...leise, fetch: f }));
  assert.deepEqual(ereignisse, [
    { typ: "text", text: "Guten " },
    { typ: "text", text: "Morgen" },
    { typ: "ende", tokensEin: 11, tokensAus: 3, geschaetzt: false },
  ]);
  assert.equal(bodies[0].stream, true);
});

test("Stream: ohne usage-Block werden Tokens geschätzt (4 Zeichen ≈ 1 Token) und markiert", async () => {
  const logs: Record<string, unknown>[] = [];
  const { f } = fetchMit(() => new Response(strom([delta("12345678")]), { status: 200 }));
  const ereignisse = await sammeln(kiAnfrageStreamMit(KONFIG, { nutzer: "x", maxTokens: 50, temperatur: 0 }, { ...leise, log: (e) => logs.push(e), fetch: f }));
  const ende = ereignisse.at(-1) as Extract<StreamEreignis, { typ: "ende" }>;
  assert.equal(ende.tokensAus, 2);
  assert.equal(ende.geschaetzt, true);
  assert.equal(logs[0].tokens_geschaetzt, true);
});

test("Stream: Abbruch mittendrin → Text bleibt, Fehler-Ereignis, kein Retry", async () => {
  let aufrufe = 0;
  const { f } = fetchMit(() => {
    aufrufe++;
    return new Response(strom([delta("Teil 1 "), delta("Teil 2")], 2), { status: 200 });
  });
  const ereignisse = await sammeln(kiAnfrageStreamMit(KONFIG, { nutzer: "x", maxTokens: 50, temperatur: 0 }, { ...leise, fetch: f }));
  assert.deepEqual(ereignisse.filter((e) => e.typ === "text").map((e) => (e as { text: string }).text), ["Teil 1 ", "Teil 2"]);
  const fehler = ereignisse.find((e) => e.typ === "fehler") as Extract<StreamEreignis, { typ: "fehler" }>;
  assert.ok(fehler.fehler instanceof KiAbgebrochen);
  assert.equal(ereignisse.at(-1)?.typ, "ende");
  assert.equal(aufrufe, 1);
});

test("Stream: 429 vor dem ersten Stück wird geworfen (kein Retry)", async () => {
  let aufrufe = 0;
  const { f } = fetchMit(() => {
    aufrufe++;
    return new Response("{}", { status: 429 });
  });
  await assert.rejects(sammeln(kiAnfrageStreamMit(KONFIG, { nutzer: "x", maxTokens: 5, temperatur: 0 }, { ...leise, fetch: f })), KiAusgelastet);
  assert.equal(aufrufe, 1);
});

test("Stream: Werkzeugaufrufe aus Bruchstücken zusammengesetzt (auch id 'null', parallele Aufrufe)", async () => {
  const tc = (index: number, id: string | undefined, name: string | undefined, args: string) =>
    sse({ choices: [{ delta: { tool_calls: [{ index, ...(id ? { id } : {}), function: { ...(name ? { name } : {}), arguments: args } }] } }] });
  const { f } = fetchMit(
    () =>
      new Response(
        strom([tc(0, "abc123def", "pruefungen_lesen", '{"von":'), tc(0, "null", undefined, '"2026-11-13"}'), tc(1, "xyz987uvw", "faecher_auflisten", "{}")]),
        { status: 200 },
      ),
  );
  const ereignisse = await sammeln(
    kiAnfrageStreamMit(KONFIG, { nutzer: "x", maxTokens: 5, temperatur: 0, werkzeuge: [{ name: "pruefungen_lesen", beschreibung: "B", parameter: { type: "object" } }] }, { ...leise, fetch: f }),
  );
  const w = ereignisse.find((e) => e.typ === "werkzeuge") as Extract<StreamEreignis, { typ: "werkzeuge" }>;
  assert.deepEqual(w.aufrufe, [
    { id: "abc123def", name: "pruefungen_lesen", argumente: '{"von":"2026-11-13"}' },
    { id: "xyz987uvw", name: "faecher_auflisten", argumente: "{}" },
  ]);
});

test("Nachrichten: Werkzeugaufrufe im OpenAI-Format, tools + tool_choice gesendet", async () => {
  const liste = nachrichtenBauen({
    maxTokens: 1,
    temperatur: 0,
    nachrichten: [
      { role: "user", content: "Frage" },
      { role: "assistant", content: "", tool_calls: [{ id: "a1", name: "faecher_auflisten", argumente: "{}" }] },
      { role: "tool", tool_call_id: "a1", name: "faecher_auflisten", content: "[]" },
    ],
  });
  assert.deepEqual(liste[1], { role: "assistant", content: "", tool_calls: [{ id: "a1", type: "function", function: { name: "faecher_auflisten", arguments: "{}" } }] });
  assert.deepEqual(liste[2], { role: "tool", tool_call_id: "a1", name: "faecher_auflisten", content: "[]" });

  const { f, bodies } = fetchMit(
    () => new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: [{ id: "q", function: { name: "faecher_auflisten", arguments: {} } }] } }] }), { status: 200 }),
  );
  const antwort = await kiAnfrageMit(KONFIG, { nutzer: "x", maxTokens: 5, temperatur: 0, werkzeuge: [{ name: "faecher_auflisten", beschreibung: "Fächer", parameter: { type: "object", properties: {} } }] }, { ...leise, fetch: f });
  assert.deepEqual(antwort.werkzeugAufrufe, [{ id: "q", name: "faecher_auflisten", argumente: "{}" }]);
  assert.equal(bodies[0].tool_choice, "auto");
  assert.deepEqual(bodies[0].tools, [{ type: "function", function: { name: "faecher_auflisten", description: "Fächer", parameters: { type: "object", properties: {} } } }]);
});

// ---------------------------------------------------------------------------
// Tool-Schleife
// ---------------------------------------------------------------------------

/** Modell-Mock: liefert pro Runde vorgegebene Ereignisse und merkt sich die Nachrichten. */
function modell(runden: StreamEreignis[][]) {
  const gesehen: unknown[][] = [];
  const rufen: ModellAufruf = async function* (o) {
    gesehen.push(structuredClone(o.nachrichten ?? []));
    const r = runden[Math.min(gesehen.length - 1, runden.length - 1)];
    for (const e of r) yield e;
  };
  return { rufen, gesehen };
}
const ende = (ein = 10, aus = 5): StreamEreignis => ({ typ: "ende", tokensEin: ein, tokensAus: aus, geschaetzt: false });
const ruft = (name: string, argumente = "{}", id = "id1"): StreamEreignis => ({ typ: "werkzeuge", aufrufe: [{ id, name, argumente }] });

const FAECHER: Werkzeug = {
  name: "faecher_auflisten",
  beschreibung: "Listet Fächer",
  parameter: { type: "object", properties: {} },
  statusText: "Schaue in deine Fächer …",
  ausfuehren: async () => [{ id: "f1", name: "Mathe 1" }],
};

test("Agent: Werkzeug → Ergebnis zurück → Antwort; Tokens summiert, Status gemeldet", async () => {
  const { rufen, gesehen } = modell([[ruft("faecher_auflisten"), ende(100, 10)], [{ typ: "text", text: "Du hast Mathe 1." }, ende(150, 8)]]);
  const ereignisse = await sammeln(agentLauf({ rufen, optionen: { maxTokens: 100, temperatur: 0 }, nachrichten: [{ role: "user", content: "Welche Fächer?" }], werkzeuge: [FAECHER] }));
  assert.deepEqual(
    ereignisse.map((e) => e.typ),
    ["status", "werkzeug", "text", "ende"],
  );
  assert.equal((ereignisse[0] as Extract<AgentEreignis, { typ: "status" }>).text, "Schaue in deine Fächer …");
  const e = ereignisse.at(-1) as Extract<AgentEreignis, { typ: "ende" }>;
  assert.equal(e.tokensEin, 250);
  assert.equal(e.tokensAus, 18);
  assert.equal(e.runden, 2);
  // Zweite Runde sieht Assistent-Aufruf + Werkzeugergebnis
  const zweite = gesehen[1] as { role: string; content: string; tool_call_id?: string }[];
  assert.deepEqual(zweite.map((n) => n.role), ["user", "assistant", "tool"]);
  assert.equal(zweite[2].tool_call_id, "id1");
  assert.equal(zweite[2].content, '[{"id":"f1","name":"Mathe 1"}]');
  assert.deepEqual(e.neueNachrichten.map((n) => n.role), ["assistant", "tool", "assistant"]);
});

test("Agent: nach 5 Runden mit Werkzeugwünschen → KiZuKomplex", async () => {
  const { rufen, gesehen } = modell([[ruft("faecher_auflisten"), ende()]]);
  const ereignisse = await sammeln(agentLauf({ rufen, optionen: { maxTokens: 1, temperatur: 0 }, nachrichten: [{ role: "user", content: "?" }], werkzeuge: [FAECHER] }));
  assert.equal(gesehen.length, 5);
  const fehler = ereignisse.find((e) => e.typ === "fehler") as Extract<AgentEreignis, { typ: "fehler" }>;
  assert.ok(fehler.fehler instanceof KiZuKomplex);
  assert.equal(fehler.fehler.nutzerMeldung, "Das war zu kompliziert, versuch es mit einer kürzeren Frage.");
  assert.equal((ereignisse.at(-1) as Extract<AgentEreignis, { typ: "ende" }>).runden, 5);
});

test("Agent: unbekanntes Werkzeug, kaputtes JSON und Werkzeugfehler gehen als Fehler ans Modell zurück", async () => {
  const kaputt: Werkzeug = { ...FAECHER, name: "kaputt", ausfuehren: async () => { throw new Error("DB weg"); } };
  const { rufen, gesehen } = modell([
    [{ typ: "werkzeuge", aufrufe: [{ id: "a", name: "gibts_nicht", argumente: "{}" }, { id: "b", name: "faecher_auflisten", argumente: "{kaputt" }, { id: "c", name: "kaputt", argumente: "{}" }] }, ende()],
    [{ typ: "text", text: "Ok." }, ende()],
  ]);
  const ereignisse = await sammeln(agentLauf({ rufen, optionen: { maxTokens: 1, temperatur: 0 }, nachrichten: [{ role: "user", content: "?" }], werkzeuge: [FAECHER, kaputt] }));
  const tools = (gesehen[1] as { role: string; content: string }[]).filter((n) => n.role === "tool").map((n) => JSON.parse(n.content).fehler);
  assert.deepEqual(tools, ["Unbekanntes Werkzeug: gibts_nicht", "Die Parameter waren kein gültiges JSON-Objekt.", "Das Werkzeug ist fehlgeschlagen."]);
  assert.equal(ereignisse.at(-1)?.typ, "ende");
});

test("Agent: Abbruch im Stream beendet den Lauf, bisheriger Text wird gespeichert", async () => {
  const { rufen } = modell([[{ typ: "text", text: "Halb" }, { typ: "fehler", fehler: new KiAbgebrochen("weg") }, ende()]]);
  const ereignisse = await sammeln(agentLauf({ rufen, optionen: { maxTokens: 1, temperatur: 0 }, nachrichten: [{ role: "user", content: "?" }], werkzeuge: [] }));
  const e = ereignisse.at(-1) as Extract<AgentEreignis, { typ: "ende" }>;
  assert.deepEqual(e.neueNachrichten, [{ role: "assistant", content: "Halb" }]);
});

test("Agent: Fehler vor der ersten Ausgabe wird geworfen (z. B. ausgelastet)", async () => {
  const rufen: ModellAufruf = async function* () {
    throw new KiAusgelastet();
  };
  await assert.rejects(sammeln(agentLauf({ rufen, optionen: { maxTokens: 1, temperatur: 0 }, nachrichten: [], werkzeuge: [] })), KiAusgelastet);
});
