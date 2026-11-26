import { test } from "node:test";
import assert from "node:assert/strict";
import { JsonObjektPuffer, ZeilenPuffer, ereignisseAusStream, mockStream } from "./stream-leser.ts";
import { BEISPIEL_EREIGNISSE, BEISPIEL_NDJSON } from "./beispiel.ts";
import { ereignisLesen, type WbEreignis } from "./protokoll.ts";

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

/** Text (optional in Stuecken) durch den Objekt-Puffer schicken und als Ereignisse lesen. */
function objekteAlsEreignisse(text: string, stueck = 7): (WbEreignis | null)[] {
  const p = new JsonObjektPuffer();
  const roh: string[] = [];
  for (let i = 0; i < text.length; i += stueck) roh.push(...p.schlucken(text.slice(i, i + stueck)));
  return roh.map((o) => ereignisLesen(o));
}

test("JsonObjektPuffer: NDJSON (ein Objekt pro Zeile) wird vollstaendig gelesen", () => {
  assert.deepEqual(objekteAlsEreignisse(BEISPIEL_NDJSON), BEISPIEL_EREIGNISSE);
});

test("JsonObjektPuffer: ein einzeiliges JSON-Array liefert dieselben Objekte", () => {
  const array = JSON.stringify(BEISPIEL_EREIGNISSE);
  assert.deepEqual(objekteAlsEreignisse(array), BEISPIEL_EREIGNISSE);
});

test("JsonObjektPuffer: mehrzeilig eingerueckt (pretty-printed) wird zusammengesetzt", () => {
  const pretty = JSON.stringify(BEISPIEL_EREIGNISSE, null, 2);
  assert.deepEqual(objekteAlsEreignisse(pretty, 11), BEISPIEL_EREIGNISSE);
});

test("JsonObjektPuffer: in einem Markdown-Codeblock verpackt", () => {
  const umhuellt = "```json\n" + BEISPIEL_NDJSON + "\n```\n";
  assert.deepEqual(objekteAlsEreignisse(umhuellt), BEISPIEL_EREIGNISSE);
});

test("JsonObjektPuffer: Klammern und Anfuehrungszeichen im Text spalten nicht", () => {
  const knifflig = '{"typ":"sagen","text":"a } { \\" b"}\n{"typ":"fertig"}';
  assert.deepEqual(objekteAlsEreignisse(knifflig, 3), [{ typ: "sagen", text: 'a } { " b' }, { typ: "fertig" }]);
});

test("JsonObjektPuffer: Strich mit Punkt-Array bleibt ein Objekt", () => {
  const text = '[{"typ":"strich","punkte":[1,2,3,4]},{"typ":"fertig"}]';
  assert.deepEqual(objekteAlsEreignisse(text, 4), [{ typ: "strich", punkte: [1, 2, 3, 4] }, { typ: "fertig" }]);
});

test("JsonObjektPuffer: ein noch offenes Objekt wird erst spaeter geliefert", () => {
  const p = new JsonObjektPuffer();
  assert.deepEqual(p.schlucken('{"typ":"sagen",'), []);
  assert.deepEqual(p.schlucken('"text":"ok"}'), ['{"typ":"sagen","text":"ok"}']);
});
