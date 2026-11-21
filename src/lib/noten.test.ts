import { test } from "node:test";
import assert from "node:assert/strict";
import { abschneiden, benoetigteNote, gesamtMitModul, gesamtnote, gewichteterSchnitt, modulnote, notenText, schnittMit, schnittProFach, zahlLesen, zielnoteNachEcts } from "./noten.ts";

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

// Noten wie an der Uni: Module nach ECTS, Teilnoten nach Anteil, abgeschnitten

const ECTS: Record<string, number | null> = { a: 10, b: 5, c: null, d: 6 };
const ects = (id: string) => ECTS[id];

test("Uni: abschneiden statt runden", () => {
  assert.equal(abschneiden(1.98), 1.9);
  assert.equal(abschneiden(2.0), 2);
  assert.equal(abschneiden(2.3), 2.3);
  assert.equal(abschneiden(1.9999), 1.9);
});

test("Uni: Modulnote aus Teilnoten nach Anteil (Klausur 70, Hausarbeit 30)", () => {
  const m = modulnote([
    { wert: 1.7, gewicht: 70, fach_id: "a" },
    { wert: 2.7, gewicht: 30, fach_id: "a" },
  ]);
  assert.equal(m.note, 2); // 1,7·0,7 + 2,7·0,3 = 2,0
  assert.equal(m.vorlaeufig, false);
  const offen = modulnote([
    { wert: 1.3, gewicht: 1, fach_id: "a" },
    { wert: null, gewicht: 1, fach_id: "a" },
  ]);
  assert.equal(offen.note, 1.3);
  assert.equal(offen.vorlaeufig, true);
});

test("Uni: Gesamtnote nach ECTS, Modul über zwei Semester zählt einmal", () => {
  const g = gesamtnote(
    [
      { wert: 1.3, gewicht: 1, fach_id: "a" }, // Teil 1, Wintersemester
      { wert: 2.3, gewicht: 1, fach_id: "a" }, // Teil 2, Sommersemester: Modul a = 1,8
      { wert: 3.0, gewicht: 1, fach_id: "b" },
    ],
    ects,
  );
  // (1,8·10 + 3,0·5) / 15 = 2,2
  assert.equal(g.wert, 2.2);
  assert.equal(g.ects, 15);
  assert.equal(g.nachEcts, true);
});

test("Uni: ohne ECTS, nicht bestanden und ausstehend zählen nicht", () => {
  const g = gesamtnote(
    [
      { wert: 1.0, gewicht: 1, fach_id: "a" },
      { wert: 1.0, gewicht: 1, fach_id: "c" },
      { wert: 5.0, gewicht: 1, fach_id: "d" },
      { wert: null, gewicht: 1, fach_id: "b" },
    ],
    ects,
  );
  assert.equal(g.wert, 1);
  assert.deepEqual(g.ohneEcts, ["c"]);
  assert.deepEqual(g.nichtBestanden, ["d"]);
});

test("Uni: kein Fach mit ECTS, dann wie bisher nach Gewicht", () => {
  const g = gesamtnote(
    [
      { wert: 1.7, gewicht: 6, fach_id: "x" },
      { wert: 2.3, gewicht: 4, fach_id: "y" },
    ],
    () => null,
  );
  assert.equal(g.nachEcts, false);
  assert.equal(g.wert, abschneiden((1.7 * 6 + 2.3 * 4) / 10));
});

test("Uni: Rechner mit ECTS und Abschneiden", () => {
  const g = gesamtnote([{ wert: 2.0, gewicht: 1, fach_id: "a" }], ects);
  assert.equal(gesamtMitModul(g, 1.0, 10), 1.5);
  assert.equal(gesamtMitModul(g, 5.0, 10), null);
  // Ziel 1,9 mit 10 restlichen ECTS: genauer Schnitt < 2,0 heißt Rest < 2,0, also 1,9
  assert.deepEqual(zielnoteNachEcts(g, 1.9, 10), { art: "note", wert: 1.9 });
  assert.deepEqual(zielnoteNachEcts(g, 2.0, 10), { art: "note", wert: 2.1 });
  assert.deepEqual(zielnoteNachEcts(g, 1.0, 10), { art: "unmoeglich" });
  assert.deepEqual(zielnoteNachEcts(g, 3.5, 10), { art: "sicher" });
  assert.deepEqual(zielnoteNachEcts(g, 2.0, 0), { art: "ungueltig" });
});
