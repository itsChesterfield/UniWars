import { test } from "node:test";
import assert from "node:assert/strict";
import { alsNaechstes, bandLage, dateiTyp, kuerzen, lageSatz, szeneBeiScroll, wannKurz, woche, zuletztText } from "./hub-buehne.ts";

const jetzt = new Date("2026-11-18T17:42:00Z"); // Mi 18:42 in Berlin

const daten = {
  deadlines: [
    { id: "d1", titel: "Hausarbeit Testtheorie abgeben", faellig_am: "2026-11-18T22:59:00Z", erledigt: false, fach_id: "f2", typ: "ABGABE" },
    { id: "d2", titel: "Alt", faellig_am: "2026-11-01T10:00:00Z", erledigt: true, fach_id: null },
    { id: "d3", titel: "Gliederung schicken", faellig_am: "2026-11-25T10:00:00Z", erledigt: false, fach_id: null },
  ],
  todos: [
    { id: "t1", titel: "Kapitel 3 lesen", erledigt: false, parent_id: null, fach_id: "f1", faellig_am: null, prioritaet: "NIEDRIG" },
    { id: "t2", titel: "Unterpunkt", erledigt: false, parent_id: "t1", fach_id: null, faellig_am: null },
    { id: "t3", titel: "Wichtig", erledigt: false, parent_id: null, fach_id: null, faellig_am: null, prioritaet: "HOCH" },
  ],
  pruefungen: [{ id: "p1", titel: "Testat Methodenlehre", datum: "2026-11-19T08:00:00Z", fach_id: "f2", status: "ANSTEHEND", raum: "S 204" }],
};

test("alsNaechstes: nach Zeit, erledigte und Unterpunkte weg, To-dos ohne Datum nach Priorität", () => {
  const e = alsNaechstes(daten, jetzt);
  assert.deepEqual(e.map((x) => x.id), ["d1", "p1", "d3", "t3", "t1"]);
  assert.equal(e[0].art, "Abgabe");
  assert.equal(e[0].dringend, true);
  assert.equal(e[2].dringend, false);
});

test("wannKurz", () => {
  assert.equal(wannKurz("2026-11-18T22:59:00Z", jetzt), "heute 23:59");
  assert.equal(wannKurz("2026-11-19T08:00:00Z", jetzt), "morgen 09:00");
  assert.equal(wannKurz("2026-11-21T10:00:00Z", jetzt), "Sa");
  assert.equal(wannKurz("2026-11-25T10:00:00Z", jetzt), "25.11.");
  assert.equal(wannKurz("2026-11-17T10:00:00Z", jetzt), "überfällig");
  assert.equal(wannKurz(null, jetzt), "offen");
});

test("lageSatz", () => {
  const s = lageSatz(alsNaechstes(daten, jetzt), jetzt);
  assert.match(s.text, /^Heute zählt Hausarbeit Testtheorie abgeben\./);
  assert.ok(s.betont.includes("abgeben."));
  assert.match(lageSatz([], jetzt).text, /nichts an/);
  assert.match(lageSatz([{ id: "x", quelle: "todo", art: "To-do", titel: "A", fachId: null, wann: null, dringend: false }], jetzt).text, /Keine Frist/);
});

test("kuerzen am Wortende", () => {
  assert.equal(kuerzen("kurz", 10), "kurz");
  assert.equal(kuerzen("Ein sehr langer Titel der nicht passt", 16), "Ein sehr langer …");
});

test("woche: sieben Tage, heute markiert, Ereignisse sortiert", () => {
  const w = woche({ stundenplan: [{ id: "s1", tag: "MI", start_zeit: "14:00:00", end_zeit: "15:30:00", fach_id: "f3", raum: "3.12" }], deadlines: daten.deadlines, pruefungen: daten.pruefungen, fachName: (id) => (id === "f3" ? "Entwicklung" : null) }, jetzt);
  assert.equal(w.length, 7);
  assert.equal(w[0].kurz, "Mo");
  assert.equal(w[2].heute, true);
  assert.equal(w[2].zahl, 18);
  assert.deepEqual(w[2].ereignisse.map((e) => e.id), ["s1", "d1"]);
  assert.equal(w[3].ereignisse[0].art, "pruefung");
  assert.equal(w[3].ereignisse[0].von, 9);
});

test("bandLage begrenzt auf 8 bis 23 Uhr", () => {
  assert.deepEqual(bandLage(8, 9.5), { links: 0, breite: 10 });
  assert.deepEqual(bandLage(6, 8), { links: 0, breite: 0 });
  assert.deepEqual(bandLage(22, 25), { links: 93.33, breite: 6.67 });
});

test("szeneBeiScroll rastet ein", () => {
  assert.equal(szeneBeiScroll(0, 800, 5), 0);
  assert.equal(szeneBeiScroll(390, 800, 5), 0);
  assert.equal(szeneBeiScroll(410, 800, 5), 1);
  assert.equal(szeneBeiScroll(99999, 800, 5), 4);
  assert.equal(szeneBeiScroll(100, 0, 5), 0);
});

test("dateiTyp und zuletztText", () => {
  assert.equal(dateiTyp("application/pdf", "a.pdf"), "PDF");
  assert.equal(dateiTyp("application/vnd.openxmlformats-officedocument.presentationml.presentation", "f.pptx"), "Folien");
  assert.equal(dateiTyp("audio/mp4", "x.m4a"), "Audio");
  assert.equal(dateiTyp("application/octet-stream", "x"), "Datei");
  assert.equal(zuletztText("2026-11-18T15:42:00Z", jetzt), "vor 2 Std.");
  assert.equal(zuletztText("2026-11-17T10:00:00Z", jetzt), "gestern");
  assert.equal(zuletztText("2026-11-04T10:00:00Z", jetzt), "04.11.");
});
