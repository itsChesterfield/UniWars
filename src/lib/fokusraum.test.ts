import { test } from "node:test";
import assert from "node:assert/strict";
import { initiale, raumTopic, restMs, teilnehmerListe } from "./fokusraum.ts";

test("Fokusraum: Topics der Räume", () => {
  assert.equal(raumTopic({ art: "alle", id: null }), "fokusraum:alle");
  assert.equal(raumTopic({ art: "hs", id: "Q123" }), "fokusraum:hs:Q123");
  assert.equal(raumTopic({ art: "gruppe", id: "abc" }), "fokusraum:gruppe:abc");
});

test("Fokusraum: Liste sortiert (ich zuerst, dann Fokus vor Pause), anonym erlaubt", () => {
  const liste = teilnehmerListe(
    {
      a: [{ n: "Ron", f: null, m: "kurz", l: true, e: 1, r: 0 }],
      b: [{ n: null, f: null, m: "fokus", l: true, e: 1, r: 0 }],
      c: [{ n: "Max", f: "Statistik", m: "fokus", l: false, e: null, r: 5 }],
    },
    "c",
  );
  assert.deepEqual(liste.map((t) => t.key), ["c", "b", "a"]);
  assert.equal(initiale(null), "?");
  assert.equal(initiale("lea"), "L");
  assert.equal(restMs({ l: true, e: 10_000, r: 0 }, 4_000), 6_000);
  assert.equal(restMs({ l: false, e: null, r: 7 }, 4_000), 7);
});
