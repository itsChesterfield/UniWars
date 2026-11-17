import { test } from "node:test";
import assert from "node:assert/strict";
import { gerichteAufbereiten, naechsterOffenerTag, preisText } from "./mensa.ts";

test("Mensa: Gerichte aufbereiten (Preis, vegan, vegetarisch)", () => {
  const g = gerichteAufbereiten([
    { name: "Graupen- Steckrübeneintopf | Mettwurst", category: "Tellergericht", prices: { students: 2.6 }, notes: ["Gluten"] },
    { name: "Kerala Gemüsecurry | Kurkumareis", category: "Vegetarisch", prices: { students: 2.5 }, notes: ["vegan"] },
    { name: "Käsespätzle", category: "Hauptgericht", prices: { students: null }, notes: ["vegetarisch"] },
    { name: "", category: "x" },
    { name: " | Gnocchi | Speck | | Sauce", category: "Pasta" },
  ]);
  assert.equal(g.length, 4);
  assert.equal(g[3].name, "Gnocchi · Speck · Sauce");
  assert.equal(g[0].name, "Graupen- Steckrübeneintopf · Mettwurst");
  assert.deepEqual([g[0].vegan, g[0].vegetarisch], [false, false]);
  assert.deepEqual([g[1].vegan, g[1].vegetarisch], [true, true]);
  assert.deepEqual([g[2].vegetarisch, g[2].preis], [true, null]);
});

test("Mensa: nächster geöffneter Tag", () => {
  const tage = [
    { date: "2026-11-16", closed: false },
    { date: "2026-11-17", closed: true },
    { date: "2026-11-18", closed: false },
  ];
  assert.equal(naechsterOffenerTag(tage, "2026-11-17"), "2026-11-18");
  assert.equal(naechsterOffenerTag([], "2026-11-17"), null);
  assert.equal(preisText(2.5).replace(/\s/g, " "), "2,50 €");
});
