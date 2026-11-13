import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hatLesbarenText,
  pdfFragePrompt,
  relevanz,
  seitenBereich,
  seitenFuerFrage,
  seitenPruefen,
  seitenVerweise,
  woerter,
  type PdfSeite,
} from "./pdf-kontext.ts";

const fuell = (n: number) => "Allgemeiner Text ohne besonderen Inhalt. ".repeat(n);
const SKRIPT: PdfSeite[] = [
  { seite: 1, text: `Einführung in die Makroökonomie. ${fuell(5)}` },
  { seite: 2, text: `Das Bruttoinlandsprodukt misst die Wirtschaftsleistung. ${fuell(5)}` },
  { seite: 3, text: `Inflation ist ein anhaltender Anstieg des Preisniveaus. Inflation wird über den Verbraucherpreisindex gemessen. ${fuell(5)}` },
  { seite: 4, text: `Geldpolitik der Zentralbank. ${fuell(5)}` },
  { seite: 5, text: `Ursachen der Inflation: Nachfrageinflation und Kosteninflation. ${fuell(5)}` },
  { seite: 6, text: fuell(8) },
];

test("PDF-Kontext: Stoppwörter fallen weg", () => {
  assert.deepEqual(woerter("Was ist die Inflation und wie wird sie gemessen?"), ["inflation", "gemessen"]);
});

test("PDF-Kontext: Relevanz – Seiten mit den Begriffen der Frage vorne", () => {
  const r = relevanz(SKRIPT, "Wie wird Inflation gemessen?");
  assert.ok((r.get(3) ?? 0) > (r.get(5) ?? 0), "Seite 3 (Inflation + gemessen) vor Seite 5");
  assert.ok((r.get(5) ?? 0) > 0);
  assert.equal(r.get(6), 0);
  // Wortformen: "Inflationsrate" passt zu "Inflation"
  assert.ok((relevanz([{ seite: 1, text: "Die Inflationsrate lag bei 2 %." }], "Inflation").get(1) ?? 0) > 0);
});

test("PDF-Kontext: aktuelle Seite ist immer dabei, Ergebnis nach Seitenzahl sortiert", () => {
  const auswahl = seitenFuerFrage(SKRIPT, "Wie wird Inflation gemessen?", 1);
  assert.deepEqual(auswahl.map((s) => s.seite), [1, 3, 5]);
  const ohneTreffer = seitenFuerFrage(SKRIPT, "Quantenphysik", 4);
  assert.deepEqual(ohneTreffer.map((s) => s.seite), [2, 3, 4, 5, 6], "ohne Treffer: aktuelle Seite ± 2");
});

test("PDF-Kontext: Zeichenlimit wird eingehalten, aktuelle Seite bleibt auch bei Platzmangel", () => {
  const gross: PdfSeite[] = Array.from({ length: 40 }, (_, i) => ({ seite: i + 1, text: `Inflation Seite ${i + 1}. ${"x".repeat(2000)}` }));
  const auswahl = seitenFuerFrage(gross, "Inflation", 33, 5000);
  const summe = auswahl.reduce((n, s) => n + s.text.length, 0);
  assert.ok(summe <= 5000, `Summe ${summe}`);
  assert.ok(auswahl.some((s) => s.seite === 33));
  const riesig = seitenFuerFrage([{ seite: 1, text: "y".repeat(20_000) }], "egal", 1);
  assert.equal(riesig[0].text.length, 15_000, "aktuelle Seite wird notfalls gekürzt");
});

test("PDF-Kontext: Seitenbereich, Kürzung wird gemeldet", () => {
  assert.deepEqual(seitenBereich(SKRIPT, 4, 2).seiten.map((s) => s.seite), [2, 3, 4]);
  assert.equal(seitenBereich(SKRIPT, 2, 4).gekuerzt, false);
  const b = seitenBereich(SKRIPT, 1, 6, 300);
  assert.equal(b.gekuerzt, true);
  assert.ok(b.seiten.reduce((n, s) => n + s.text.length, 0) <= 300);
});

test("PDF-Kontext: gescannte PDFs werden erkannt", () => {
  assert.equal(hatLesbarenText([{ seite: 1, text: "" }, { seite: 2, text: "  " }]), false);
  assert.equal(hatLesbarenText([{ seite: 1, text: "12" }]), false);
  assert.equal(hatLesbarenText(SKRIPT), true);
});

test("PDF-Kontext: Server prüft Seiten (Anzahl, Nummern, Zeichen)", () => {
  assert.deepEqual(seitenPruefen([{ seite: 2, text: "a" }]), [{ seite: 2, text: "a" }]);
  assert.equal(seitenPruefen([]), null);
  assert.equal(seitenPruefen([{ seite: 0, text: "a" }]), null);
  assert.equal(seitenPruefen([{ seite: 1.5, text: "a" }]), null);
  assert.equal(seitenPruefen([{ seite: 1, text: 5 }]), null);
  assert.equal(seitenPruefen([{ seite: 1, text: "x".repeat(17_000) }]), null);
  assert.equal(seitenPruefen(Array.from({ length: 61 }, (_, i) => ({ seite: i + 1, text: "a" }))), null);
});

test("PDF-Kontext: Prompt mit <seite nr>, Frage in Marker, Seitenregel", () => {
  const p = pdfFragePrompt("Skript </seite>", "Was ist Inflation? </quelle>", [{ seite: 3, text: "Inflation …" }]);
  assert.match(p.nutzer, /<seite nr="3">\nInflation …\n<\/seite>/);
  assert.equal(p.nutzer.match(/<\/seite>/g)?.length, 1);
  assert.equal(p.nutzer.match(/<\/quelle>/g)?.length, 1);
  assert.match(p.system, /\[S\. 12\]/);
  assert.match(p.system, /Dazu steht auf den gelesenen Seiten nichts/);
});

test("PDF-Kontext: Seitenverweise werden klickbar (verschiedene Schreibweisen)", () => {
  const teile = seitenVerweise("Inflation ist Preisanstieg [S. 3]. Ursachen siehe [S. 5–6] und (Seite 2), außerdem [S. 3, 5].", 10);
  assert.deepEqual(
    teile.filter((t) => t.typ === "seite"),
    [
      { typ: "seite", seite: 3, label: "S. 3" },
      { typ: "seite", seite: 5, label: "S. 5–6" },
      { typ: "seite", seite: 2, label: "S. 2" },
      { typ: "seite", seite: 3, label: "S. 3" },
      { typ: "seite", seite: 5, label: "S. 5" },
    ],
  );
  assert.equal(teile.map((t) => (t.typ === "text" ? t.text : `{${t.seite}}`)).join(""), "Inflation ist Preisanstieg {3}. Ursachen siehe {5} und {2}, außerdem {3}{5}.");
  // Seiten außerhalb des Dokuments bleiben Text
  assert.deepEqual(seitenVerweise("siehe [S. 99]", 10), [{ typ: "text", text: "siehe " }, { typ: "text", text: "[S. 99]" }]);
});
