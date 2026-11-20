import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLE_BEREICHE,
  STANDARD_DARSTELLUNG,
  bereichUmsetzen,
  bereichVerschieben,
  bereichZeigen,
  darstellungLesen,
  designAttribut,
  gleicheSymbolleiste,
  sichtbaresDesign,
  standardSymbolleiste,
  symbolleisteLesen,
  symbolleistenGruppen,
  tabLeiste,
} from "./personalisierung.ts";

test("Design: Attribut und sichtbares Design, auch „Wie das System“", () => {
  assert.equal(designAttribut("DUNKEL"), "nacht");
  assert.equal(designAttribut("HELL"), "hochschule");
  assert.equal(designAttribut("SYSTEM"), "system");
  assert.equal(designAttribut(null), "hochschule");
  assert.equal(sichtbaresDesign("SYSTEM", true), "DUNKEL");
  assert.equal(sichtbaresDesign("SYSTEM", false), "HELL");
  assert.equal(sichtbaresDesign("HELL", true), "HELL");
  assert.equal(sichtbaresDesign("DUNKEL", false), "DUNKEL");
});

test("Darstellung lesen: Standard bei Unbrauchbarem, unbekannte Werte fallen auf den Standard", () => {
  for (const roh of [null, undefined, "x", [], 3]) assert.deepEqual(darstellungLesen(roh), STANDARD_DARSTELLUNG);
  assert.deepEqual(darstellungLesen({ schrift: "gross", dichte: "eng", bewegung: "ruhig", design_schalter: "ja", fremd: 1 }), {
    schrift: "gross",
    dichte: "normal",
    bewegung: "reduziert",
    leiste: "auto",
    design_schalter: false,
  });
  assert.equal(darstellungLesen({ design_schalter: true }).design_schalter, true);
  assert.equal(darstellungLesen({ leiste: "offen" }).leiste, "offen");
  assert.equal(darstellungLesen({ leiste: "breit" }).leiste, "auto");
  // Wer „Beim Drüberfahren“ ausdrücklich gewählt hat, behält es; neu ist nur der Standard
  assert.equal(darstellungLesen({ leiste: "hover" }).leiste, "hover");
  assert.equal(STANDARD_DARSTELLUNG.leiste, "auto");
});

test("Symbolleiste lesen: Standard, Gruppen bleiben fest, Neues hängt am Gruppenende", () => {
  assert.deepEqual(symbolleisteLesen(null), standardSymbolleiste());
  const s = symbolleisteLesen({ reihe: ["chat", "notizen", "hub", "notizen", "gibtsnicht", 4], aus: ["hub", "mindmap", "mindmap", "x"] });
  const [taeglich, studium] = symbolleistenGruppen(s);
  assert.deepEqual(taeglich.eintraege.map((e) => e.id), ["notizen", "hub", "work-station", "karteikarten"]);
  assert.equal(studium.eintraege[0].id, "chat");
  assert.equal(s.reihe.length, ALLE_BEREICHE.length);
  assert.deepEqual(s.aus, ["mindmap"], "Hub bleibt sichtbar, Doppeltes und Unbekanntes fällt weg");
});

test("Symbolleiste: Verschieben nur innerhalb der Gruppe", () => {
  const s = standardSymbolleiste();
  assert.equal(bereichVerschieben(s, "notizen", 1), null, "letzter in Täglich");
  assert.equal(bereichVerschieben(s, "pdf-reader", -1), null, "erster in Studium");
  const n = bereichVerschieben(s, "notizen", -1)!;
  assert.deepEqual(n.reihe.slice(0, 4), ["hub", "work-station", "notizen", "karteikarten"]);
  assert.deepEqual(bereichUmsetzen(s, "notizen", "chat"), s, "Gruppenwechsel ist nicht erlaubt");
  assert.deepEqual(bereichUmsetzen(s, "whiteboard", "textverarbeitung").reihe.slice(-5), ["whiteboard", "textverarbeitung", "tabellen", "praesentationen", "mindmap"]);
});

test("Symbolleiste: Ausblenden, Hub immer sichtbar, Tab-Leiste mit den ersten vier sichtbaren", () => {
  let s = standardSymbolleiste();
  assert.deepEqual(bereichZeigen(s, "hub", false), s);
  s = bereichZeigen(s, "karteikarten", false);
  assert.deepEqual(tabLeiste(s), ["hub", "work-station", "notizen", "pdf-reader"]);
  s = bereichZeigen(s, "karteikarten", true);
  assert.ok(gleicheSymbolleiste(s, standardSymbolleiste()));
});

test("CSS: „Wie das System“ im Dunkeln nutzt genau die Token des Sternenhimmels", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const block = (start: string) => {
    const i = css.indexOf(start);
    assert.ok(i >= 0, `${start} fehlt`);
    const auf = css.indexOf("{", i + start.length);
    return css.slice(auf + 1, css.indexOf("}", auf)).replace(/\s+/g, " ").trim();
  };
  assert.equal(block('@media (prefers-color-scheme: dark) {\n  [data-theme="system"]'), block('\n[data-theme="nacht"]'));
});
