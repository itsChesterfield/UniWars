import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutBerechnen, knotenBreite } from "./layout.ts";
import { ereignisAnwenden, LEERE_ZEICHNUNG, type Zeichnung } from "./zeichnung.ts";
import { BEISPIEL_EREIGNISSE } from "./beispiel.ts";

function bauen(...ids: string[]): Zeichnung {
  return ids.reduce((z, id) => ereignisAnwenden(z, { typ: "knoten", id, label: id, form: "kasten" }), LEERE_ZEICHNUNG);
}

test("knotenBreite bleibt in den Grenzen", () => {
  assert.ok(knotenBreite("A") >= 104);
  assert.ok(knotenBreite("x".repeat(200)) <= 240);
});

test("Kette: Ebenen schieben Knoten nach rechts", () => {
  let z = bauen("a", "b", "c");
  z = ereignisAnwenden(z, { typ: "kante", von: "a", nach: "b" });
  z = ereignisAnwenden(z, { typ: "kante", von: "b", nach: "c" });
  const l = layoutBerechnen(z);
  const x = (id: string) => l.knoten.find((k) => k.id === id)!.x;
  assert.ok(x("a") < x("b"), "b rechts von a");
  assert.ok(x("b") < x("c"), "c rechts von b");
  assert.equal(l.kanten.length, 2);
});

test("Kante auf unbekannten Knoten wird uebersprungen", () => {
  let z = bauen("a");
  z = ereignisAnwenden(z, { typ: "kante", von: "a", nach: "fehlt" });
  const l = layoutBerechnen(z);
  assert.equal(l.knoten.length, 1);
  assert.equal(l.kanten.length, 0);
});

test("Zyklus sprengt das Layout nicht (endliche Koordinaten)", () => {
  let z = bauen("a", "b");
  z = ereignisAnwenden(z, { typ: "kante", von: "a", nach: "b" });
  z = ereignisAnwenden(z, { typ: "kante", von: "b", nach: "a" });
  const l = layoutBerechnen(z);
  for (const k of l.knoten) {
    assert.ok(Number.isFinite(k.x) && Number.isFinite(k.y));
  }
  assert.ok(Number.isFinite(l.breite) && Number.isFinite(l.hoehe));
});

test("Kanten-Endpunkte liegen auf dem Rand der Knoten, nicht im Zentrum", () => {
  let z = bauen("a", "b");
  z = ereignisAnwenden(z, { typ: "kante", von: "a", nach: "b" });
  const l = layoutBerechnen(z);
  const a = l.knoten.find((k) => k.id === "a")!;
  const kante = l.kanten[0];
  const zentrumX = a.x + a.b / 2;
  // Startpunkt sollte vom Zentrum weg Richtung b verschoben sein.
  assert.notEqual(kante.x1, zentrumX);
});

test("Beispiel-Reflexbogen: 6 Knoten, 5 Kanten, Titel", () => {
  const z = BEISPIEL_EREIGNISSE.reduce(ereignisAnwenden, LEERE_ZEICHNUNG);
  const l = layoutBerechnen(z);
  assert.equal(l.knoten.length, 6);
  assert.equal(l.kanten.length, 5);
  assert.equal(z.titel, "Der Reflexbogen");
});
