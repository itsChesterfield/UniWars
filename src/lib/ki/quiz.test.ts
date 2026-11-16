import { test } from "node:test";
import assert from "node:assert/strict";
import { alsKarte, bewerten, bewertungLesen, einstellungenLesen, normalisieren, podcastLesen, quizLesen, schwaechen, type QuizFrage } from "./quiz.ts";

const antwort = JSON.stringify({
  titel: "Statistik",
  fragen: [
    { typ: "mc", frage: "Was ist der Median?", optionen: ["Mitte", "Mittel", "Modus", "Spanne"], richtig: 0, thema: "Lagemaße" },
    { typ: "wf", frage: "Die Varianz ist nie negativ.", richtig: true },
    { typ: "luecke", frage: "Die ___ misst die Streuung.", loesung: "Standardabweichung" },
    { typ: "zuordnen", frage: "Ordne zu", paare: [{ links: "Mittelwert", rechts: "Summe/n" }, { links: "Median", rechts: "Mitte" }] },
    { typ: "frei", frage: "Erkläre Korrelation.", musterloesung: "Zusammenhang zweier Variablen", kernpunkte: ["Zusammenhang", "kein Kausalschluss"] },
    { typ: "mc", frage: "kaputt", optionen: ["a"], richtig: 3 },
    { typ: "zauber", frage: "?" },
  ],
});

test("quizLesen: gültige Fragen aller Typen, ungültige verworfen", () => {
  const q = quizLesen(antwort);
  assert.equal(q.titel, "Statistik");
  assert.deepEqual(q.fragen.map((f) => f.typ), ["mc", "wf", "luecke", "zuordnen", "frei"]);
  assert.ok(q.fragen.every((f) => f.id));
  assert.equal(new Set(q.fragen.map((f) => f.id)).size, 5);
});

test("bewerten: lokal, Lückentext tolerant", () => {
  const [mc, wf, luecke, zuordnen, frei] = quizLesen(antwort).fragen;
  assert.equal(bewerten(mc, 0)?.richtig, true);
  assert.equal(bewerten(mc, 2)?.punkte, 0);
  assert.equal(bewerten(wf, false)?.richtig, false);
  assert.equal(bewerten(luecke, "die standardabweichnug")?.richtig, true);
  assert.equal(bewerten(luecke, "Varianz")?.richtig, false);
  assert.equal(bewerten(zuordnen, [0, 1])?.punkte, 1);
  assert.equal(bewerten(zuordnen, [1, 1])?.punkte, 0.5);
  assert.equal(bewerten(frei, "x"), null);
});

test("bewertungLesen rundet auf 0 / 0,5 / 1", () => {
  assert.equal(bewertungLesen('{"punkte":0.6,"feedback":"ok"}').punkte, 0.5);
  assert.equal(bewertungLesen('{"punkte":1}').richtig, true);
  assert.equal(bewertungLesen("Unsinn").punkte, 0);
});

test("schwaechen: letzte Antwort falsch oder 2 von 3", () => {
  const f = quizLesen(antwort).fragen as QuizFrage[];
  const s = schwaechen(f, [{ antworten: [{ frageId: f[0].id, punkte: 0 }, { frageId: f[1].id, punkte: 1 }] }, { antworten: [{ frageId: f[1].id, punkte: 0 }] }]);
  assert.deepEqual(s.fragen, [f[0].id]);
  assert.deepEqual(s.themen, ["Lagemaße"]);
});

test("einstellungenLesen begrenzt Werte", () => {
  assert.deepEqual(einstellungenLesen({ anzahl: 99, typen: ["mc", "quatsch"] }), { anzahl: 30, schwierigkeit: "mittel", typen: ["mc"] });
  assert.equal(einstellungenLesen({}).typen.length, 4);
});

test("normalisieren und alsKarte", () => {
  assert.equal(normalisieren("Die Größe!"), "grosse");
  const wf = quizLesen(antwort).fragen[1];
  assert.match(alsKarte(wf).vorderseite, /^Wahr oder falsch/);
});

test("podcastLesen teilt lange Beiträge", () => {
  const lang = "Das ist ein Satz. ".repeat(60);
  const p = podcastLesen(JSON.stringify({ titel: "T", segmente: [{ sprecher: 2, text: lang }, { sprecher: 7, text: "Hallo" }] }));
  assert.ok(p.segmente.length >= 3);
  assert.ok(p.segmente.every((s) => s.text.length <= 700));
  assert.equal(p.segmente.at(-1)?.sprecher, 1);
});
