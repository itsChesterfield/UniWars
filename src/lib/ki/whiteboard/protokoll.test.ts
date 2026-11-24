import { test } from "node:test";
import assert from "node:assert/strict";
import { ereignisLesen, MAX_SAGEN_ZEICHEN, MAX_LABEL_ZEICHEN, MAX_ID_ZEICHEN } from "./protokoll.ts";

test("sagen: gültige Zeile", () => {
  assert.deepEqual(ereignisLesen('{"typ":"sagen","text":"Fangen wir mit dem Reiz an."}'), {
    typ: "sagen",
    text: "Fangen wir mit dem Reiz an.",
  });
});

test("sagen: Text wird getrimmt", () => {
  assert.deepEqual(ereignisLesen('{"typ":"sagen","text":"  Hallo  "}'), { typ: "sagen", text: "Hallo" });
});

test("sagen: leerer Text ist ungültig", () => {
  assert.equal(ereignisLesen('{"typ":"sagen","text":"   "}'), null);
  assert.equal(ereignisLesen('{"typ":"sagen"}'), null);
});

test("sagen: zu langer Text ist ungültig", () => {
  const lang = "a".repeat(MAX_SAGEN_ZEICHEN + 1);
  assert.equal(ereignisLesen(`{"typ":"sagen","text":"${lang}"}`), null);
});

test("knoten: mit Form", () => {
  assert.deepEqual(ereignisLesen('{"typ":"knoten","id":"reiz","label":"Reiz","form":"ellipse"}'), {
    typ: "knoten",
    id: "reiz",
    label: "Reiz",
    form: "ellipse",
  });
});

test("knoten: ohne Form fällt auf kasten zurück", () => {
  assert.deepEqual(ereignisLesen('{"typ":"knoten","id":"reiz","label":"Reiz"}'), {
    typ: "knoten",
    id: "reiz",
    label: "Reiz",
    form: "kasten",
  });
});

test("knoten: unbekannte Form fällt auf kasten zurück", () => {
  assert.deepEqual(ereignisLesen('{"typ":"knoten","id":"a","label":"A","form":"wolke"}'), {
    typ: "knoten",
    id: "a",
    label: "A",
    form: "kasten",
  });
});

test("knoten: fehlende id oder label ist ungültig", () => {
  assert.equal(ereignisLesen('{"typ":"knoten","label":"Reiz"}'), null);
  assert.equal(ereignisLesen('{"typ":"knoten","id":"reiz"}'), null);
});

test("knoten: zu lange id oder label ist ungültig", () => {
  const langeId = "x".repeat(MAX_ID_ZEICHEN + 1);
  const langesLabel = "y".repeat(MAX_LABEL_ZEICHEN + 1);
  assert.equal(ereignisLesen(`{"typ":"knoten","id":"${langeId}","label":"A"}`), null);
  assert.equal(ereignisLesen(`{"typ":"knoten","id":"a","label":"${langesLabel}"}`), null);
});

test("kante: ohne Label", () => {
  assert.deepEqual(ereignisLesen('{"typ":"kante","von":"reiz","nach":"rezeptor"}'), {
    typ: "kante",
    von: "reiz",
    nach: "rezeptor",
  });
});

test("kante: mit Label", () => {
  assert.deepEqual(ereignisLesen('{"typ":"kante","von":"a","nach":"b","label":"leitet"}'), {
    typ: "kante",
    von: "a",
    nach: "b",
    label: "leitet",
  });
});

test("kante: fehlende Enden sind ungültig", () => {
  assert.equal(ereignisLesen('{"typ":"kante","von":"a"}'), null);
  assert.equal(ereignisLesen('{"typ":"kante","nach":"b"}'), null);
});

test("titel: gültig", () => {
  assert.deepEqual(ereignisLesen('{"typ":"titel","text":"Der Reflexbogen"}'), { typ: "titel", text: "Der Reflexbogen" });
});

test("fertig: ohne weitere Felder", () => {
  assert.deepEqual(ereignisLesen('{"typ":"fertig"}'), { typ: "fertig" });
});

test("leere Zeile ist null", () => {
  assert.equal(ereignisLesen(""), null);
  assert.equal(ereignisLesen("   "), null);
});

test("kaputtes JSON ist null, kein Absturz", () => {
  assert.equal(ereignisLesen('{"typ":"sagen","text":'), null);
  assert.equal(ereignisLesen("kein json"), null);
});

test("unbekannter Typ ist null", () => {
  assert.equal(ereignisLesen('{"typ":"loeschen","id":"a"}'), null);
  assert.equal(ereignisLesen('{"id":"a"}'), null);
});

test("JSON-Nicht-Objekt ist null", () => {
  assert.equal(ereignisLesen('"nur ein string"'), null);
  assert.equal(ereignisLesen("42"), null);
  assert.equal(ereignisLesen("null"), null);
  assert.equal(ereignisLesen("[1,2,3]"), null);
});
