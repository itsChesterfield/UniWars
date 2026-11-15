import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anteilAusPosition,
  anteilBegrenzen,
  aufteilungLesen,
  gegenueber,
  istAppPfad,
  zitatAlsText,
  zitatLesen,
  zoneAusPosition,
} from "./geteilte-ansicht.ts";

test("Geteilte Ansicht: Ablagezone aus Zeigerposition", () => {
  assert.equal(zoneAusPosition(50, 400, 1000, 800), "links");
  assert.equal(zoneAusPosition(950, 400, 1000, 800), "rechts");
  assert.equal(zoneAusPosition(500, 20, 1000, 800), "oben");
  assert.equal(zoneAusPosition(500, 780, 1000, 800), "unten");
  // Mitte rechts: lieber nebeneinander als übereinander
  assert.equal(zoneAusPosition(700, 600, 1000, 800), "rechts");
  assert.equal(zoneAusPosition(0, 0, 0, 0), "rechts");
});

test("Geteilte Ansicht: Anteil begrenzen und aus Trenner-Position", () => {
  assert.equal(anteilBegrenzen(0.05), 0.2);
  assert.equal(anteilBegrenzen(0.95), 0.8);
  assert.equal(anteilBegrenzen(Number.NaN), 0.5);
  const flaeche = { left: 100, top: 0, width: 1000, height: 500 };
  assert.equal(anteilAusPosition("rechts", { x: 700, y: 0 }, flaeche), 0.4);
  assert.equal(anteilAusPosition("links", { x: 400, y: 0 }, flaeche), 0.3);
  assert.equal(anteilAusPosition("unten", { x: 0, y: 200 }, flaeche), 0.6);
  assert.equal(anteilAusPosition("oben", { x: 0, y: 490 }, flaeche), 0.8);
});

test("Geteilte Ansicht: gespeicherte Aufteilung prüfen", () => {
  assert.deepEqual(aufteilungLesen(JSON.stringify({ href: "/notizen?id=1", seite: "links", anteil: 0.3 })), {
    href: "/notizen?id=1",
    seite: "links",
    anteil: 0.3,
  });
  assert.equal(aufteilungLesen(JSON.stringify({ href: "https://boese.de", seite: "links" })), null);
  assert.equal(aufteilungLesen(JSON.stringify({ href: "//boese.de", seite: "links" })), null);
  assert.equal(aufteilungLesen(JSON.stringify({ href: "/notizen", seite: "mitte" })), null);
  assert.equal(aufteilungLesen("kein json"), null);
  assert.equal(aufteilungLesen(null), null);
  assert.equal(aufteilungLesen(JSON.stringify({ href: "/pdf-reader", seite: "unten" }))?.anteil, 0.5);
  assert.equal(istAppPfad("javascript:alert(1)"), false);
  assert.equal(gegenueber("oben"), "unten");
});

test("Zitat: Klartext und Prüfen", () => {
  const z = { text: "  Die Nachfrage sinkt.  ", quelle: "Skript.pdf", seite: 3, notiz: "wichtig" };
  assert.equal(zitatAlsText(z), "„Die Nachfrage sinkt.“ (Skript.pdf, S. 3)\nNotiz: wichtig");
  assert.equal(zitatAlsText({ text: "x", quelle: "Q" }), "„x“ (Q)");
  assert.deepEqual(zitatLesen(JSON.stringify(z)), { text: "Die Nachfrage sinkt.", quelle: "Skript.pdf", seite: 3, notiz: "wichtig" });
  assert.equal(zitatLesen(JSON.stringify({ text: " ", quelle: "Q" })), null);
  assert.equal(zitatLesen("{"), null);
  assert.equal(zitatLesen(JSON.stringify({ text: "a", quelle: "Q", seite: -2 }))?.seite, null);
});
