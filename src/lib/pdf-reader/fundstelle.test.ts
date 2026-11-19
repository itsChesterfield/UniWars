import assert from "node:assert/strict";
import { test } from "node:test";
import { pdfAusschnitt, pdfLinkLesen, pdfMarkdownLink, pdfPfad } from "./fundstelle.ts";

test("Der PDF-Seitenlink hat Vorrang vor dem Einstieg an der letzten Position", () => {
  assert.equal(pdfPfad("pdf"), "/pdf-reader/pdf");
  assert.equal(pdfPfad("pdf", 12), "/pdf-reader/pdf?seite=12");
  assert.equal(pdfPfad("pdf", -1), "/pdf-reader/pdf");
  assert.equal(pdfMarkdownLink("Skript [Statistik]", "pdf", 12, "http://localhost:3000"),
    "[Skript \\[Statistik\\], S. 12](http://localhost:3000/pdf-reader/pdf?seite=12)");
});

test("Der Treffer markiert die Schreibweise aus dem PDF und liefert Kontext", () => {
  assert.deepEqual(pdfAusschnitt("Das Konfidenzintervall beschreibt die Schätzung.", "konfidenzintervall"), {
    davor: "Das ", begriff: "Konfidenzintervall", danach: " beschreibt die Schätzung.",
  });
  assert.equal(pdfAusschnitt("Ein Punkt.", "Intervall"), null);
});

test("Ein kopierter PDF-Seitenlink lässt sich als Fundstelle übernehmen", () => {
  const id = "00000000-0000-4000-8000-000000000003";
  const ursprung = "https://uniwars.example";
  assert.deepEqual(pdfLinkLesen(pdfMarkdownLink("Skript [Statistik]", id, 12, ursprung), ursprung), { id, seite: 12 });
  assert.deepEqual(pdfLinkLesen(pdfPfad(id, 12), ursprung), { id, seite: 12 });
  assert.equal(pdfLinkLesen(pdfMarkdownLink("Skript", id, 12, "https://andere.example"), ursprung), null);
  assert.equal(pdfLinkLesen(pdfPfad(id), ursprung), null);
});
