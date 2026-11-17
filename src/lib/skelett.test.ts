import { test } from "node:test";
import assert from "node:assert/strict";
import { SKELETT_FORMEN, skelettForm } from "./skelett.ts";

test("Skelett: Form nach Bereich, Liste und Einzelansicht", () => {
  assert.equal(skelettForm("/"), "kopf");
  assert.equal(skelettForm("/termine"), "tabelle");
  assert.equal(skelettForm("/notizen?id=1"), "text");
  assert.equal(skelettForm("/chat"), "gespraech");
  assert.equal(skelettForm("/work-station"), "zwei");
  assert.equal(skelettForm("/praesentationen"), "tabelle");
  assert.equal(skelettForm("/praesentationen/abc"), "blatt");
  assert.equal(skelettForm("/mindmap/abc"), "flaeche");
  assert.equal(skelettForm("/karteikarten/abc"), "tabelle");
  assert.equal(skelettForm("/karteikarten/abc/lernen"), "blatt");
  assert.equal(skelettForm("/einstellungen/personalisierung"), "text");
  assert.equal(skelettForm("/gibt-es-nicht"), "kopf");
  assert.ok(SKELETT_FORMEN.includes(skelettForm("/pdf-reader/x")));
});
