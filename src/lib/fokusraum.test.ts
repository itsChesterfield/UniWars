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

test("Fokusraum: fremde, kaputte Einträge werfen nicht und werden bereinigt", () => {
  const liste = teilnehmerListe(
    {
      a: [{ n: 123, f: { x: 1 }, m: "fokus", l: "ja", e: "bald", r: -5 }],
      b: [{ n: "  Lea  ", f: null, m: "hack", l: true, e: null, r: 0 }],
      c: [],
      d: [null],
      e: [{ n: "x".repeat(200), f: null, m: "kurz", l: false, e: null, r: 9e15 }],
    },
    null,
  );
  assert.deepEqual(liste.map((t) => t.key).sort(), ["a", "e"]);
  const a = liste.find((t) => t.key === "a")!;
  assert.deepEqual([a.n, a.f, a.l, a.e, a.r], [null, null, false, null, 0]);
  assert.equal(initiale(a.n), "?");
  const e = liste.find((t) => t.key === "e")!;
  assert.equal(e.n?.length, 40);
  assert.equal(e.r, 24 * 3600_000);
});

test("Fokusraum: Flow zählt hoch", () => {
  assert.equal(restMs({ l: true, e: 1_000, r: 0, w: true }, 61_000), 60_000);
  assert.equal(restMs({ l: false, e: null, r: 5_000, w: true }, 99_000), 5_000);
  const [t] = teilnehmerListe({ a: [{ n: null, f: null, m: "fokus", l: true, e: 1, r: 0, w: true }] }, null);
  assert.equal(t.w, true);
});
