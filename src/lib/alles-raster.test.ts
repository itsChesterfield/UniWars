import { test } from "node:test";
import assert from "node:assert/strict";
import { rasterFiltern, rasterGruppen, suchForm } from "./alles-raster.ts";
import { standardSymbolleiste } from "./personalisierung.ts";

const NAMEN: Record<string, string[]> = {
  hub: ["Zentraler Hub", "Hub"],
  "work-station": ["Work Station", "Fokus"],
  "pdf-reader": ["PDF Reader", "PDF"],
  literaturverwaltung: ["Literatur"],
  praesentationen: ["Präsentationen", "Folien"],
};
const namen = (id: string) => NAMEN[id] ?? [id];

test("Raster: drei Gruppen wie die Symbolleiste, alle 15 Bereiche", () => {
  const g = rasterGruppen(standardSymbolleiste());
  assert.deepEqual(g.map((x) => x.name), ["Täglich", "Studium", "Werkzeuge"]);
  assert.equal(g.flatMap((x) => x.eintraege).length, 15);
  assert.equal(g[0].eintraege[0].id, "hub");
});

test("Raster: ausgeblendete Bereiche bleiben erreichbar, am Ende ihrer Gruppe", () => {
  const s = { ...standardSymbolleiste(), aus: ["work-station"] };
  const taeglich = rasterGruppen(s)[0].eintraege;
  assert.deepEqual(taeglich.map((e) => e.id), ["hub", "karteikarten", "notizen", "work-station"]);
  assert.equal(taeglich[3].ausgeblendet, true);
  assert.equal(taeglich[0].ausgeblendet, false);
});

test("Raster: Suche über Name und Kurzname, ohne Groß- und Kleinschreibung und Umlaute", () => {
  const g = rasterGruppen(standardSymbolleiste());
  assert.deepEqual(rasterFiltern(g, "fokus", namen).flatMap((x) => x.eintraege.map((e) => e.id)), ["work-station"]);
  assert.deepEqual(rasterFiltern(g, "prasent", namen).flatMap((x) => x.eintraege.map((e) => e.id)), ["praesentationen"]);
  assert.deepEqual(rasterFiltern(g, "  ", namen), g);
  assert.deepEqual(rasterFiltern(g, "gibtsnicht", namen), []);
  // Gruppen ohne Treffer fallen weg
  assert.deepEqual(rasterFiltern(g, "pdf", namen).map((x) => x.name), ["Studium"]);
});

test("suchForm: ß, Akzente, Leerzeichen", () => {
  assert.equal(suchForm("Straße"), "strasse");
  assert.equal(suchForm("Work Station"), "workstation");
  assert.equal(suchForm("Präsentationen"), "prasentationen");
});
