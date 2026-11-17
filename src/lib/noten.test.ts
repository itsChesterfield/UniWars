import { test } from "node:test";
import assert from "node:assert/strict";
import { benoetigteNote, gewichteterSchnitt, notenText, schnittMit, schnittProFach, zahlLesen } from "./noten.ts";

const NOTEN = [
  { wert: 1.7, gewicht: 6, fach_id: "a" },
  { wert: 2.3, gewicht: 4, fach_id: "b" },
  { wert: 1.3, gewicht: 2, fach_id: "a" },
];

test("Noten: gewichteter Schnitt wie notenschnitt() in der Datenbank", () => {
  assert.equal(gewichteterSchnitt([]), null);
  assert.equal(gewichteterSchnitt([{ wert: 2, gewicht: 0, fach_id: "a" }]), null);
  assert.equal(Number(gewichteterSchnitt(NOTEN)!.toFixed(4)), Number(((1.7 * 6 + 2.3 * 4 + 1.3 * 2) / 12).toFixed(4)));
});

test("Noten: Schnitt je Fach, bester zuerst", () => {
  const liste = schnittProFach(NOTEN);
  assert.deepEqual(liste.map((x) => x.fachId), ["a", "b"]);
  assert.equal(liste[0].anzahl, 2);
  assert.equal(Number(liste[0].schnitt.toFixed(2)), 1.6);
});

test("Noten: benötigte Note – kleiner ist besser", () => {
  const eine = [{ wert: 3, gewicht: 1, fach_id: "a" }];
  assert.deepEqual(benoetigteNote(eine, 2, 1), { art: "note", wert: 1 });
  assert.deepEqual(benoetigteNote(eine, 1.5, 1), { art: "unmoeglich" });
  assert.deepEqual(benoetigteNote(eine, 4, 1), { art: "sicher" });
  assert.deepEqual(benoetigteNote(eine, 2, 0), { art: "ungueltig" });
  assert.deepEqual(benoetigteNote(eine, Number.NaN, 1), { art: "ungueltig" });
});

test("Noten: Schnitt mit einer weiteren Note, Eingabe mit Komma", () => {
  assert.equal(schnittMit([{ wert: 2, gewicht: 1, fach_id: "a" }], 1, 1), 1.5);
  assert.equal(schnittMit(NOTEN, 6, 1), null);
  assert.equal(zahlLesen("1,7"), 1.7);
  assert.equal(zahlLesen(" 2.3 "), 2.3);
  assert.ok(Number.isNaN(zahlLesen("")));
  assert.equal(notenText(1.7), "1,7");
  assert.equal(notenText(2.254, 2), "2,25");
});
