import { test } from "node:test";
import assert from "node:assert/strict";
import { absichtErkennen, bewertung, falten, zuletztAktualisieren } from "./befehle.ts";

test("falten: Umlaute und Satzzeichen", () => {
  assert.equal(falten("Prüfung: Ökonomie!"), "pruefung oekonomie");
});

test("bewertung: Anfang > Wortanfang > enthalten > Initialen", () => {
  assert.ok(bewertung("Notizen", "not") > bewertung("Meine Notizen", "not"));
  assert.ok(bewertung("Meine Notizen", "not") > bewertung("Annotation", "not"));
  assert.equal(bewertung("PDF Reader", "pr"), 30);
  assert.equal(bewertung("Whiteboard", "xyz"), 0);
  assert.equal(bewertung("Statistik Skript Kapitel 3", "kapitel statistik"), 35);
  assert.equal(bewertung("Prüfungen", "prufung"), 80);
  assert.equal(bewertung("Prüfungen", "pruef"), 80);
});

test("absichtErkennen", () => {
  assert.deepEqual(absichtErkennen("neue Notiz Statistik VL 3"), { art: "notiz", titel: "Statistik VL 3" });
  assert.deepEqual(absichtErkennen("+ deadline Hausarbeit 20.12."), { art: "abgabe", titel: "Hausarbeit 20.12." });
  assert.deepEqual(absichtErkennen("Klausur Mathe am 3.2."), { art: "pruefung", titel: "Klausur Mathe am 3.2." });
  assert.deepEqual(absichtErkennen("Hausarbeit Soziologie"), { art: "abgabe", titel: "Hausarbeit Soziologie" });
  assert.deepEqual(absichtErkennen("prüfung Statistik"), { art: "pruefung", titel: "Statistik" });
  assert.deepEqual(absichtErkennen("todo: Bücher zurückgeben"), { art: "todo", titel: "Bücher zurückgeben" });
  assert.deepEqual(absichtErkennen("neues whiteboard"), { art: "whiteboard", titel: "" });
  assert.equal(absichtErkennen("notiz"), null);
  assert.equal(absichtErkennen("Statistik"), null);
});

test("zuletztAktualisieren: ohne Doppelte, max. 6", () => {
  const t = (id: string) => ({ art: "pdf", id, titel: id, href: "/", icon: "", info: "" });
  let l = [t("a"), t("b")];
  l = zuletztAktualisieren(l, t("b"));
  assert.deepEqual(l.map((x) => x.id), ["b", "a"]);
  for (const id of ["c", "d", "e", "f", "g", "h"]) l = zuletztAktualisieren(l, t(id));
  assert.equal(l.length, 6);
});
