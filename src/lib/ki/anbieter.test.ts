import { test } from "node:test";
import assert from "node:assert/strict";
import { kiAnfrageMit, type KiKonfig, type KiUmgebung } from "./anfrage.ts";
import { KiAusgelastet, KiKonfiguration, KiNichtVerfuegbar, KiZeitueberschreitung } from "./fehler.ts";

const KONFIG: KiKonfig = { basisUrl: "https://api.example.test/v1/", modell: "test-modell", apiKey: "geheim-123" };
const OPTIONEN = { system: "Du bist ein Test.", nutzer: "Hallo <notiz>Geheimer Inhalt</notiz>", maxTokens: 100, temperatur: 0.3, json: true };

type Aufruf = { url: string; init: RequestInit };

function umgebung(antworten: (() => Response | Promise<Response>)[]) {
  const aufrufe: Aufruf[] = [];
  const logs: Record<string, unknown>[] = [];
  const pausen: number[] = [];
  let i = 0;
  const u: Partial<KiUmgebung> = {
    fetch: (async (url: string, init: RequestInit) => {
      aufrufe.push({ url, init });
      const naechste = antworten[Math.min(i++, antworten.length - 1)];
      return naechste();
    }) as typeof fetch,
    warten: async (ms) => {
      pausen.push(ms);
    },
    log: (e) => logs.push(e),
    timeoutMs: 50,
  };
  return { u, aufrufe, logs, pausen };
}

const ok = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 120, completion_tokens: 45 } }), {
    status: 200,
  });
const status = (s: number) => () => new Response("{}", { status: s });

test("KI-Anfrage: Erfolg – OpenAI-Format, JSON-Modus, Tokens", async () => {
  const { u, aufrufe, logs } = umgebung([() => ok('{"karten":[]}')]);
  const antwort = await kiAnfrageMit(KONFIG, OPTIONEN, u);
  assert.deepEqual(antwort, { text: '{"karten":[]}', tokensEin: 120, tokensAus: 45, werkzeugAufrufe: [] });
  assert.equal(aufrufe.length, 1);
  assert.equal(aufrufe[0].url, "https://api.example.test/v1/chat/completions");
  const body = JSON.parse(String(aufrufe[0].init.body));
  assert.equal(body.model, "test-modell");
  assert.equal(body.max_tokens, 100);
  assert.equal(body.temperature, 0.3);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.messages.map((m: { role: string }) => m.role), ["system", "user"]);
  assert.equal((aufrufe[0].init.headers as Record<string, string>).authorization, "Bearer geheim-123");
  // Log enthält weder Key noch Inhalt
  const log = JSON.stringify(logs);
  assert.ok(!log.includes("geheim") && !log.includes("Geheimer Inhalt"), log);
  assert.equal(logs[0].status, 200);
});

test("KI-Anfrage: ohne json-Option kein response_format", async () => {
  const { u, aufrufe } = umgebung([() => ok("Hallo")]);
  await kiAnfrageMit(KONFIG, { ...OPTIONEN, json: false }, u);
  assert.equal(JSON.parse(String(aufrufe[0].init.body)).response_format, undefined);
});

test("KI-Anfrage: 429 → ein Retry nach 2 s, dann Erfolg", async () => {
  const { u, aufrufe, pausen } = umgebung([status(429), () => ok("zweiter Versuch")]);
  const antwort = await kiAnfrageMit(KONFIG, OPTIONEN, u);
  assert.equal(antwort.text, "zweiter Versuch");
  assert.equal(aufrufe.length, 2);
  assert.deepEqual(pausen, [2000]);
});

test("KI-Anfrage: 429 zweimal → KiAusgelastet, nicht öfter versucht", async () => {
  const { u, aufrufe } = umgebung([status(429), status(429), () => ok("nie")]);
  await assert.rejects(kiAnfrageMit(KONFIG, OPTIONEN, u), (e) => e instanceof KiAusgelastet && /ausgelastet/.test(e.nutzerMeldung));
  assert.equal(aufrufe.length, 2);
});

test("KI-Anfrage: 5xx zweimal → KiNichtVerfuegbar", async () => {
  const { u, aufrufe } = umgebung([status(503), status(500)]);
  await assert.rejects(kiAnfrageMit(KONFIG, OPTIONEN, u), (e) => e instanceof KiNichtVerfuegbar && e.nutzerMeldung === "KI ist gerade nicht verfügbar.");
  assert.equal(aufrufe.length, 2);
});

test("KI-Anfrage: 401 → KiKonfiguration ohne Retry, Meldung ohne Details", async () => {
  const { u, aufrufe } = umgebung([status(401), () => ok("nie")]);
  await assert.rejects(
    kiAnfrageMit(KONFIG, OPTIONEN, u),
    (e) => e instanceof KiKonfiguration && e.nutzerMeldung === "KI ist gerade nicht verfügbar." && e.message.includes("401"),
  );
  assert.equal(aufrufe.length, 1);
});

test("KI-Anfrage: Timeout → KiZeitueberschreitung ohne Retry", async () => {
  const { u, aufrufe, logs } = umgebung([
    () =>
      new Promise<Response>((_, reject) => {
        const signal = (u_aufruf()?.init.signal ?? null) as AbortSignal | null;
        signal?.addEventListener("abort", () => reject(new DOMException("abgebrochen", "AbortError")));
      }),
  ]);
  function u_aufruf() {
    return aufrufe[aufrufe.length - 1];
  }
  await assert.rejects(kiAnfrageMit(KONFIG, OPTIONEN, u), (e) => e instanceof KiZeitueberschreitung && /zu lange/.test(e.nutzerMeldung));
  assert.equal(aufrufe.length, 1);
  assert.equal(logs[0].status, "timeout");
});

test("KI-Anfrage: fehlender Key → KiKonfiguration, kein Netzwerkaufruf", async () => {
  const { u, aufrufe } = umgebung([() => ok("nie")]);
  await assert.rejects(kiAnfrageMit({ ...KONFIG, apiKey: "  " }, OPTIONEN, u), KiKonfiguration);
  await assert.rejects(kiAnfrageMit({ ...KONFIG, apiKey: undefined }, OPTIONEN, u), KiKonfiguration);
  assert.equal(aufrufe.length, 0);
});

test("KI-Anfrage: Netzwerkfehler wird einmal wiederholt", async () => {
  const { u, aufrufe } = umgebung([
    () => {
      throw new TypeError("fetch failed");
    },
    () => ok("geht wieder"),
  ]);
  assert.equal((await kiAnfrageMit(KONFIG, OPTIONEN, u)).text, "geht wieder");
  assert.equal(aufrufe.length, 2);
});
