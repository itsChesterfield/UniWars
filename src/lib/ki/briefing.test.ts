import { test } from "node:test";
import assert from "node:assert/strict";
import { anwenden, briefingLesen, standardGruss, tageszeit, vorschlaegeBerechnen, type Lage } from "./briefing.ts";

const leer: Lage = { name: "Max", stunde: 9, wochentagName: "Montag", vorlesungen: [], deadlines: [], pruefungen: [], karten: [], schwach: [], todosOffen: 0, lernzeitGestern: 0, streak: 0 };

test("tageszeit", () => {
  assert.equal(tageszeit(7), "morgen");
  assert.equal(tageszeit(12), "mittag");
  assert.equal(tageszeit(20), "abend");
  assert.equal(tageszeit(2), "nacht");
});

test("Vorschläge nach Dringlichkeit, höchstens 4", () => {
  const v = vorschlaegeBerechnen({
    ...leer,
    deadlines: [{ id: "d1", titel: "Abgabe Peer Review", faellig_am: "", fach: "PM", stundenBis: 5 }],
    pruefungen: [{ id: "p1", titel: "Klausur", fach: "Statistik", tageBis: 12 }],
    karten: [{ stapelId: "s1", name: "Statistik", anzahl: 30 }],
    schwach: [{ thema: "Varianz", fach: "Statistik", fachId: null }],
    vorlesungen: [{ fach: "Mathe", start: "10:00:00", ende: "12:00:00", raum: "H1" }],
    todosOffen: 3,
  });
  assert.equal(v.length, 4);
  assert.equal(v[0].id, "deadline-d1");
  assert.match(v[0].grund, /in 5 Stunden/);
  assert.ok(v.some((x) => x.id === "karten" && x.href === "/karteikarten/s1/lernen"));
});

test("standardGruss: Tageszeit, Name, Wichtigstes", () => {
  assert.match(standardGruss(leer), /^Guten Morgen, Max! Heute ist nichts Dringendes/);
  const g = standardGruss({ ...leer, stunde: 20, pruefungen: [{ id: "p", titel: "K", fach: "Statistik", tageBis: 3 }] });
  assert.match(g, /^Guten Abend, Max! Statistik steht in 3 Tagen an\./);
});

test("briefingLesen und anwenden", () => {
  const v = vorschlaegeBerechnen({ ...leer, todosOffen: 2, karten: [{ stapelId: "s", name: "A", anzahl: 10 }] });
  const ki = briefingLesen(JSON.stringify({ gruss: "Moin Max!", gruende: { todos: "Zwei kleine Dinge – schnell weg damit", fremd: "x" }, reihenfolge: ["todos", "karten", "todos", "gibtsnicht"] }), v);
  assert.ok(ki);
  assert.deepEqual(ki.reihenfolge, ["todos", "karten"]);
  const a = anwenden(v, ki);
  assert.equal(a[0].id, "todos");
  assert.equal(a[0].grund, "Zwei kleine Dinge – schnell weg damit");
  assert.equal(briefingLesen("kaputt", v), null);
});

test("Überschriften: Name eingesetzt, Lage berücksichtigt, nie zweimal hintereinander", async () => {
  const { ueberschriftenFuer, ueberschriftWaehlen, einsetzen } = await import("./briefing.ts");
  const l = ueberschriftenFuer({ ...leer, stunde: 23, wochentagName: "Freitag", pruefungen: [{ id: "p", titel: "K", fach: "Statistik", tageBis: 2 }] });
  assert.ok(l.includes("Gute Nacht, Max."));
  assert.ok(l.includes("Endspurt für Statistik, Max!"));
  assert.ok(!l.some((t) => t.includes("Wochenende")), "nachts keine Wochentags-Sprüche");
  assert.ok(l.every((t) => !t.includes("{name}")));
  for (let i = 0; i < 20; i++) assert.notEqual(ueberschriftWaehlen(["a", "b"], "a", Math.random()), "a");
  assert.equal(einsetzen("Kaffee und Uni, {name}?", ""), "Kaffee und Uni?");
});
