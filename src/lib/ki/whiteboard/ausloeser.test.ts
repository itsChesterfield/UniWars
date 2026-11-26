import { test } from "node:test";
import assert from "node:assert/strict";
import { istGrafischeBitte } from "./ausloeser.ts";

test("erkennt grafische Bitten", () => {
  for (const t of [
    "Zeig es mir grafisch",
    "Kannst du mir das grafisch erklaeren?",
    "Mal mir das auf",
    "Zeichne einen Reflexbogen",
    "Erklaer das als Diagramm",
    "Visualisiere die Fotosynthese",
    "Mach mir eine Skizze davon",
    "Pack das aufs Whiteboard",
  ]) {
    assert.ok(istGrafischeBitte(t), `nicht erkannt: ${t}`);
  }
});

test("normale Fragen loesen nicht aus", () => {
  for (const t of [
    "Was ist Fotosynthese?",
    "Fasse die Notiz zusammen",
    "Erklaere mir den Reflexbogen",
    "Wie viele Knochen hat der Mensch?",
    "",
  ]) {
    assert.equal(istGrafischeBitte(t), false, `faelschlich erkannt: ${t}`);
  }
});
