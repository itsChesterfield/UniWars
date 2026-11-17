import { test } from "node:test";
import assert from "node:assert/strict";
import { domainAusMail, hochschuleSuchen, hochschuleZurMail, normalisieren, type HochschuleKurz } from "./hochschulen.ts";

const L: HochschuleKurz[] = [
  { id: "Q1", name: "RWTH Aachen", kurzname: "RWTH Aachen", ort: "Aachen", land: "DE", domains: ["rwth-aachen.de"] },
  { id: "Q2", name: "FH Aachen", kurzname: null, ort: "Aachen", land: "DE", domains: ["fh-aachen.de"] },
  { id: "Q3", name: "Ludwig-Maximilians-Universität München", kurzname: "LMU", ort: "München", land: "DE", domains: ["lmu.de", "uni-muenchen.de"] },
  { id: "Q4", name: "Westfälische Hochschule Gelsenkirchen Bocholt Recklinghausen", kurzname: null, ort: null, land: "DE", domains: ["w-hs.de"] },
  { id: "Q5", name: "Technische Universität München", kurzname: null, ort: "München", land: "DE", domains: ["tum.de"] },
];

test("Hochschule: normalisieren macht Umlaute vergleichbar", () => {
  assert.equal(normalisieren("Universität München"), normalisieren("Universitaet Muenchen"));
});

test("Hochschule: Suche nach Name, Ort und Kürzel", () => {
  assert.equal(hochschuleSuchen(L, "rwth")[0].id, "Q1");
  assert.equal(hochschuleSuchen(L, "LMU")[0].id, "Q3");
  assert.equal(hochschuleSuchen(L, "tum")[0].id, "Q5");
  assert.deepEqual(hochschuleSuchen(L, "aachen").map((h) => h.id).sort(), ["Q1", "Q2"]);
  assert.equal(hochschuleSuchen(L, "westfael")[0].id, "Q4");
  assert.equal(hochschuleSuchen(L, "muenchen technische")[0].id, "Q5");
  assert.deepEqual(hochschuleSuchen(L, "   "), []);
});

test("Hochschule: an der Mail erkennen, auch mit Subdomain", () => {
  assert.equal(domainAusMail("Max@Stud.W-HS.de"), "stud.w-hs.de");
  assert.equal(hochschuleZurMail("max@stud.w-hs.de", L)?.id, "Q4");
  assert.equal(hochschuleZurMail("max@campus.lmu.de", L)?.id, "Q3");
  assert.equal(hochschuleZurMail("max@rwth-aachen.de", L)?.id, "Q1");
  assert.equal(hochschuleZurMail("max@gmail.com", L), null);
  assert.equal(hochschuleZurMail("max@fake-rwth-aachen.de", L), null);
});

test("Hochschule: Abkürzungen wie „hs“, „fh“, „tu“, „uni“", () => {
  const liste: HochschuleKurz[] = [...L, { id: "Q6", name: "Hochschule Bochum", kurzname: null, ort: "Bochum", land: "DE", domains: ["hs-bochum.de"] }];
  assert.equal(hochschuleSuchen(liste, "hs bochum")[0].id, "Q6");
  assert.equal(hochschuleSuchen(liste, "tu münchen")[0].id, "Q5");
});
