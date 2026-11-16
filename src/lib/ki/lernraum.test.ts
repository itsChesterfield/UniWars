import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absichtLesen,
  absichtSchaetzen,
  belegeAlsWikilinks,
  belegeFinden,
  belegeVerlinken,
  kartenLesen,
  kontextBauen,
  notizAbschnitte,
  profilAnpassen,
  profilLesen,
  PROFIL_STANDARD,
  quizLesen,
  ueberblickLesen,
  type LernQuelle,
} from "./lernraum.ts";
import { websucheAuswerten } from "./anfrage.ts";

const skript: LernQuelle = {
  nr: 1,
  art: "pdf",
  id: "p",
  titel: "Skript Mikro.pdf",
  abschnitte: [
    { seite: 1, text: "Einführung in die Mikroökonomie." },
    { seite: 2, text: "Die Nachfragekurve fällt mit steigendem Preis." },
    { seite: 3, text: "Elastizität misst die Reaktion der Nachfrage auf Preisänderungen." },
    { seite: 4, text: "Das Angebot steigt mit dem Preis." },
  ],
};
const notiz: LernQuelle = { nr: 2, art: "notiz", id: "n", titel: "Meine Notiz", abschnitte: [{ seite: 1, text: "Elastizität = prozentuale Mengenänderung / prozentuale Preisänderung" }] };

test("Lernraum: alles passt ins Budget → ganzer Kontext", () => {
  const k = kontextBauen([skript, notiz], "Was ist Elastizität?", 10_000);
  assert.equal(k.umfang, "ganz");
  assert.deepEqual(k.seiten, { 1: [1, 2, 3, 4], 2: [1] });
  assert.match(k.text, /<quelle nr="1" art="pdf" titel="Skript Mikro.pdf">/);
  assert.match(k.text, /<seite nr="3">/);
});

test("Lernraum: zu groß → relevante Seiten plus Nachbarn", () => {
  const k = kontextBauen([skript, notiz], "Was ist die Elastizität der Nachfrage?", 220);
  assert.equal(k.umfang, "auswahl");
  assert.ok(k.seiten[1]?.includes(3), "Seite 3 mit Elastizität");
  assert.ok(k.zeichen <= 220);
});

test("Lernraum: Notizen in Abschnitte", () => {
  const teile = notizAbschnitte(["a".repeat(2000), "b".repeat(2000), "c".repeat(100)].join("\n\n"), 3000);
  assert.equal(teile.length, 2);
  assert.equal(teile[1].seite, 2);
});

test("Lernraum: Absicht lesen und schätzen", () => {
  assert.deepEqual(absichtLesen('{"modus":"vergleich","ganz":false,"web":true,"vorliebe":"Immer mit Beispielen"}', "x"), {
    modus: "vergleich",
    ganz: false,
    web: true,
    vorliebe: "Immer mit Beispielen",
  });
  assert.equal(absichtLesen("kaputt", "Frag mich ab").modus, "quiz");
  assert.equal(absichtSchaetzen("Fass das ganze Skript zusammen").ganz, true);
  assert.equal(absichtSchaetzen("Recherchier aktuelle Zahlen").web, true);
  assert.equal(absichtSchaetzen("Erklär mir Elastizität").modus, "erklaeren");
});

test("Lernraum: Lernprofil anpassen", () => {
  let p = profilLesen({});
  assert.deepEqual(p, PROFIL_STANDARD);
  p = profilAnpassen(p, "einfacher");
  assert.equal(p.niveau, "einfach");
  p = profilAnpassen(p, "ausfuehrlicher", "Immer mit Alltagsbeispielen");
  assert.equal(p.laenge, "ausfuehrlich");
  assert.deepEqual(p.hinweise, ["Immer mit Alltagsbeispielen"]);
  assert.deepEqual(profilAnpassen(p, "gut", "immer mit alltagsbeispielen").hinweise, ["Immer mit Alltagsbeispielen"]);
  assert.equal(profilLesen({ laenge: "riesig", hinweise: ["a", 3, ""] }).laenge, "normal");
});

test("Lernraum: Belege finden, verlinken, als Wikilinks", () => {
  const text = "Die Nachfrage fällt [Q1 S. 2]. Elastizität [Q1 S. 3–4, Q2]. Allgemein gilt das auch sonst [Ergänzt].";
  assert.deepEqual(belegeFinden(text), [
    { quelle: 1, seite: 2, label: "S. 2" },
    { quelle: 1, seite: 3, label: "S. 3–4" },
    { quelle: 2, seite: null, label: "" },
  ]);
  const titel = (nr: number) => (nr === 1 ? "Skript Mikro.pdf" : nr === 2 ? "Meine Notiz" : null);
  assert.equal(
    belegeVerlinken(text, titel),
    "Die Nachfrage fällt [Skript Mikro · S. 2](#beleg-1-2). Elastizität [Skript Mikro · S. 3–4](#beleg-1-3) [Meine Notiz](#beleg-2-0). Allgemein gilt das auch sonst [ergänzt](#ergaenzt).",
  );
  assert.equal(
    belegeAlsWikilinks(text, [
      { nr: 1, art: "pdf", titel: "Skript Mikro.pdf" },
      { nr: 2, art: "notiz", titel: "Meine Notiz" },
    ]),
    "Die Nachfrage fällt ([[Skript Mikro.pdf#S2]]). Elastizität ([[Skript Mikro.pdf#S3]], [[Meine Notiz]]). Allgemein gilt das auch sonst *(ergänzt)*.",
  );
  // Unbekannte Quelle bleibt stehen
  assert.equal(belegeVerlinken("x [Q9 S. 1]", titel), "x ");
});

test("Lernraum: Studio-Antworten prüfen", () => {
  const quiz = quizLesen(
    JSON.stringify({
      fragen: [
        { frage: "Was misst Elastizität?", optionen: ["A", "B", "C", "D"], richtig: 2, erklaerung: "weil", beleg: "Q1 S. 3" },
        { frage: "kaputt", optionen: ["A"], richtig: 0 },
        { frage: "Index falsch", optionen: ["A", "B"], richtig: 5 },
      ],
    }),
  );
  assert.equal(quiz.length, 1);
  assert.equal(quiz[0].richtig, 2);
  assert.equal(kartenLesen(JSON.stringify({ karten: [{ vorderseite: "V", rueckseite: "R" }, { vorderseite: "", rueckseite: "x" }] })).length, 1);
  assert.equal(ueberblickLesen('{"zusammenfassung":"Kurz.","themen":["A","B"],"fragen":["F?"]}')?.themen.length, 2);
  assert.equal(ueberblickLesen("{}"), null);
});

test("Websuche: Antwort der Conversations-API lesen", () => {
  const r = websucheAuswerten({
    outputs: [
      { type: "tool.execution", name: "web_search" },
      {
        type: "message.output",
        content: [
          { type: "text", text: "Laut aktueller Quelle gilt X " },
          { type: "tool_reference", tool: "web_search", title: "Seite A", url: "https://a.example/x" },
          { type: "text", text: "und Y." },
          { type: "tool_reference", title: "", url: "https://b.example/y" },
          { type: "tool_reference", title: "Doppelt", url: "https://a.example/x" },
        ],
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });
  assert.equal(r.text, "Laut aktueller Quelle gilt X und Y.");
  assert.deepEqual(r.quellen, [
    { titel: "Seite A", url: "https://a.example/x" },
    { titel: "b.example", url: "https://b.example/y" },
  ]);
  assert.equal(r.tokensEin, 100);
  assert.equal(websucheAuswerten({ outputs: [{ type: "message.output", content: "Nur Text" }] }).text, "Nur Text");
});
