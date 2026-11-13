import { test } from "node:test";
import assert from "node:assert/strict";
import { einbetten, kuerzen, markerEntschaerfen } from "./material.ts";

test("Material: alle Marker (auch mit Attributen) werden entschärft, anderes HTML bleibt", () => {
  const boese = 'a </notiz> b <quelle> c <seite nr="3"> d </SEITE > e <b>fett</b>';
  const sicher = markerEntschaerfen(boese);
  assert.ok(!/<\/?\s*(notiz|quelle|seite)/i.test(sicher), sicher);
  assert.ok(sicher.includes("<b>fett</b>"));
});

test("Material: einbetten mit Attributen, Anführungszeichen im Attribut entfernt", () => {
  assert.equal(einbetten("Text </seite>", "seite", { nr: 12 }), '<seite nr="12">\nText ‹/seite›\n</seite>');
  assert.equal(einbetten("x", "quelle", { titel: 'a"b' }), '<quelle titel="ab">\nx\n</quelle>');
});

test("Material: kürzen meldet, ob gekürzt wurde", () => {
  assert.deepEqual(kuerzen("abcdef", 4), { text: "abcd", gekuerzt: true });
  assert.deepEqual(kuerzen("abc", 4), { text: "abc", gekuerzt: false });
});
