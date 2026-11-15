import { test } from "node:test";
import assert from "node:assert/strict";
import { naechsteVorlesung, vorschlaegeBerechnen, type Jetzt } from "./vorschlaege.ts";

const jetzt: Jetzt = { datum: "2026-11-16", tag: "MO", uhr: "09:00" };

test("Karteikarten-Vorschläge: nächste Vorlesung", () => {
  const v = [
    { fach_id: "a", tag: "MO" as const, start_zeit: "08:00:00" },
    { fach_id: "a", tag: "DI" as const, start_zeit: "10:15:00" },
    { fach_id: "b", tag: "MO" as const, start_zeit: "14:00:00" },
  ];
  assert.deepEqual(naechsteVorlesung(v, "a", jetzt), { inTagen: 1, uhr: "10:15" });
  assert.deepEqual(naechsteVorlesung(v, "b", jetzt), { inTagen: 0, uhr: "14:00" });
  assert.equal(naechsteVorlesung(v, "c", jetzt), null);
  // Montag 8 Uhr ist schon vorbei → erst nächste Woche, falls nur das existiert
  assert.deepEqual(naechsteVorlesung([v[0]], "a", jetzt), { inTagen: 7, uhr: "08:00" });
});

test("Karteikarten-Vorschläge: Prüfung und fällige Karten gewichten", () => {
  const stapel = [
    { id: "1", name: "Statistik", fach_id: "stat", anzahl: 40, faellig: 3 },
    { id: "2", name: "Mikro", fach_id: "mikro", anzahl: 30, faellig: 12 },
    { id: "3", name: "Recht", fach_id: "recht", anzahl: 20, faellig: 0 },
    { id: "4", name: "Leer", fach_id: "stat", anzahl: 0, faellig: 0 },
    { id: "5", name: "Ruhig", fach_id: null, anzahl: 10, faellig: 0 },
  ];
  const pruefungen = [
    { fach_id: "stat", datum: "2026-11-18T09:00:00+01:00", titel: "Klausur Statistik" },
    { fach_id: "recht", datum: "2026-12-30T09:00:00+01:00", titel: "Klausur Recht" },
    { fach_id: "mikro", datum: "2026-10-01T09:00:00+01:00", titel: "alt" },
  ];
  const vorlesungen = [{ fach_id: "mikro", tag: "MO" as const, start_zeit: "14:00:00" }];
  const v = vorschlaegeBerechnen(stapel, pruefungen, vorlesungen, jetzt);
  assert.deepEqual(
    v.map((x) => x.stapel.id),
    ["1", "2"],
  );
  assert.deepEqual(v[0].gruende, ["3 Karten zur Wiederholung fällig", "Klausur Statistik in 2 Tagen"]);
  assert.deepEqual(v[1].gruende, ["12 Karten zur Wiederholung fällig", "Vorlesung heute um 14:00"]);
});

test("Karteikarten-Vorschläge: höchstens drei, nichts ohne Grund", () => {
  const stapel = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `S${i}`, fach_id: null, anzahl: 5, faellig: i }));
  const v = vorschlaegeBerechnen(stapel, [], [], jetzt);
  assert.deepEqual(
    v.map((x) => x.stapel.id),
    ["4", "3", "2"],
  );
  assert.deepEqual(vorschlaegeBerechnen([{ id: "x", name: "x", fach_id: null, anzahl: 3, faellig: 0 }], [], [], jetzt), []);
});
