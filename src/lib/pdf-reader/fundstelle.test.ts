import assert from "node:assert/strict";
import { test } from "node:test";
import { pdfAusschnitt, pdfMarkdownLink, pdfPfad } from "./fundstelle.ts";

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
