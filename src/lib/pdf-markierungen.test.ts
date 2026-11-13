import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alsRechtecke,
  istFarbe,
  markierungenAlsText,
  punktTrifft,
  rechteckeAusAuswahl,
  zusammenfassen,
} from "./pdf-reader/markierungen.ts";

const seite = { left: 100, top: 50, width: 600, height: 800 };

test("Auswahl-Rechtecke werden seitenrelativ und pro Zeile zusammengefasst", () => {
  const r = rechteckeAusAuswahl(
    [
      { left: 160, top: 130, width: 120, height: 16 }, // Zeile 1, Teil 1
      { left: 282, top: 131, width: 60, height: 15 }, // Zeile 1, Teil 2 (direkt daneben)
      { left: 160, top: 150, width: 200, height: 16 }, // Zeile 2
    ],
    seite,
  );
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], [0.1, 0.1, 0.3033, 0.02]);
  assert.equal(r[1][1], 0.125);
});

test("Rechtecke außerhalb der Seite, leere und riesige Kästen werden verworfen", () => {
  const r = rechteckeAusAuswahl(
    [
      { left: 0, top: 0, width: 50, height: 20 }, // links neben der Seite
      { left: 200, top: 200, width: 0, height: 15 }, // leer
      { left: 100, top: 50, width: 600, height: 800 }, // ganze Seite (endOfContent)
      { left: 650, top: 100, width: 100, height: 10 }, // ragt rechts raus → wird abgeschnitten
    ],
    seite,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0][0] + r[0][2], 1);
});

test("Zusammenfassen trennt weit auseinanderliegende Stücke derselben Zeile", () => {
  const r = zusammenfassen([
    [0.1, 0.1, 0.1, 0.02],
    [0.6, 0.1, 0.1, 0.02],
  ]);
  assert.equal(r.length, 2);
});

test("Treffer-Prüfung, Datenprüfung und Farben", () => {
  assert.equal(punktTrifft([[0.1, 0.1, 0.2, 0.02]], 0.15, 0.11), true);
  assert.equal(punktTrifft([[0.1, 0.1, 0.2, 0.02]], 0.15, 0.2), false);
  assert.deepEqual(alsRechtecke([[0, 0, 1, 1], "x", [1, 2], [0, 0, NaN, 1]]), [[0, 0, 1, 1]]);
  assert.deepEqual(alsRechtecke(null), []);
  assert.equal(istFarbe("GELB"), true);
  assert.equal(istFarbe("LILA"), false);
});

test("Export als Text, nach Seiten sortiert, mit Notizen", () => {
  const text = markierungenAlsText("Skript.pdf", [
    { seite: 3, text: "Zweitens ", notiz: null },
    { seite: 1, text: "Erstens", notiz: " wichtig " },
  ]);
  assert.equal(text, "Markierungen aus „Skript.pdf“\n\nS. 1: „Erstens“\n   Notiz: wichtig\nS. 3: „Zweitens“");
});
