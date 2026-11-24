import { test } from "node:test";
import assert from "node:assert/strict";
import { ZeilenPuffer, ereignisseAusStream, mockStream } from "./stream-leser.ts";
import { BEISPIEL_EREIGNISSE, BEISPIEL_NDJSON } from "./beispiel.ts";
import type { WbEreignis } from "./protokoll.ts";

test("ZeilenPuffer: haelt die unfertige letzte Zeile zurueck", () => {
  const p = new ZeilenPuffer();
  assert.deepEqual(p.schlucken('{"a":1}\n{"b":'), ['{"a":1}']);
  assert.equal(p.rest(), '{"b":');
  assert.deepEqual(p.schlucken('2}\n'), ['{"b":2}']);
  assert.equal(p.rest(), "");
});

test("ZeilenPuffer: ein Stueck ohne Zeilenende liefert nichts", () => {
  const p = new ZeilenPuffer();
  assert.deepEqual(p.schlucken("halb"), []);
  assert.deepEqual(p.schlucken("e Zeile\n"), ["halbe Zeile"]);
});

async function sammeln(ndjson: string, stueck = 7) {
  const ereignisse: WbEreignis[] = [];
  let kaputt = 0;
  await ereignisseAusStream(mockStream(ndjson, stueck), {
    aufEreignis: (e) => ereignisse.push(e),
    aufKaputt: (n) => (kaputt = n),
  });
  return { ereignisse, kaputt };
}

test("Stream: Beispiel wird trotz krummer Stuecke vollstaendig gelesen", async () => {
  const { ereignisse, kaputt } = await sammeln(BEISPIEL_NDJSON, 5);
  assert.equal(kaputt, 0);
  assert.equal(ereignisse.length, BEISPIEL_EREIGNISSE.length);
  assert.deepEqual(ereignisse[0], BEISPIEL_EREIGNISSE[0]);
  assert.deepEqual(ereignisse.at(-1), { typ: "fertig" });
});

test("Stream: kaputte Zeilen werden gezaehlt, nicht geworfen", async () => {
  const text = ['kein json', '{"typ":"sagen","text":"ok"}', '{"typ":"sagen","text":', '{"typ":"fertig"}'].join("\n");
  const { ereignisse, kaputt } = await sammeln(text, 9);
  assert.equal(kaputt, 2);
  assert.deepEqual(ereignisse, [{ typ: "sagen", text: "ok" }, { typ: "fertig" }]);
});

test("Stream: letzte Zeile ohne Zeilenende wird noch verarbeitet", async () => {
  const { ereignisse } = await sammeln('{"typ":"sagen","text":"eins"}\n{"typ":"fertig"}', 100);
  assert.equal(ereignisse.length, 2);
});

test("Stream: abgebrochenes Signal stoppt ohne Fehler", async () => {
  const steuerung = new AbortController();
  const ereignisse: WbEreignis[] = [];
  steuerung.abort();
  await ereignisseAusStream(mockStream(BEISPIEL_NDJSON), { aufEreignis: (e) => ereignisse.push(e) }, steuerung.signal);
  assert.equal(ereignisse.length, 0);
});
