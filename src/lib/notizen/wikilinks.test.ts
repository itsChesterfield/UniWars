import { test } from "node:test";
import assert from "node:assert/strict";
import { istPdfName, linksUmbenennen, tagsFinden, wikilinksFinden, zielText, zielZerlegen } from "./wikilinks.ts";

test("Wikilinks: Ziele zerlegen", () => {
  assert.deepEqual(zielZerlegen("Skript.pdf#S12"), { name: "Skript.pdf", seite: 12 });
  assert.deepEqual(zielZerlegen("Skript.pdf#Seite 3"), { name: "Skript.pdf", seite: 3 });
  assert.deepEqual(zielZerlegen("Übung #3"), { name: "Übung #3", seite: null });
  assert.deepEqual(zielZerlegen("Vorlesung 3"), { name: "Vorlesung 3", seite: null });
  assert.equal(zielText("A.pdf", 4), "A.pdf#S4");
  assert.equal(zielText("A", null), "A");
  assert.equal(istPdfName("Skript.PDF"), true);
  assert.equal(istPdfName("Skript"), false);
});

test("Wikilinks: im Text finden", () => {
  const text = "Siehe [[Vorlesung 3]] und [[Skript.pdf#S12|Folie]].\n```\n[[Nicht im Code]]\n```\nNochmal [[vorlesung 3]] und `[[auch nicht]]`.";
  assert.deepEqual(wikilinksFinden(text), [
    { name: "Vorlesung 3", seite: null, label: null },
    { name: "Skript.pdf", seite: 12, label: "Folie" },
  ]);
  assert.deepEqual(wikilinksFinden("kein Link [x](y)"), []);
});

test("Wikilinks: beim Umbenennen anpassen", () => {
  assert.equal(
    linksUmbenennen("A [[Alt]] B [[alt|Text]] C [[Alter Name]] D [[Alt#S2]]", "Alt", "Neu"),
    "A [[Neu]] B [[Neu|Text]] C [[Alter Name]] D [[Neu#S2]]",
  );
  assert.equal(linksUmbenennen("[[A.b]]", "A.b", "C"), "[[C]]");
  assert.equal(linksUmbenennen("[[A]]", "A", "A"), "[[A]]");
});

test("Tags finden", () => {
  assert.deepEqual(tagsFinden("# Überschrift\nText #Klausur und #mikro/kapitel-2, nicht a#b\n`#code`"), ["klausur", "mikro/kapitel-2"]);
});
