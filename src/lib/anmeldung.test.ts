import { test } from "node:test";
import assert from "node:assert/strict";
import { adresse, anmeldeFehler, bestaetigenText, registrierFehler, sendeFehler } from "./anmeldung.ts";

test("anmeldeFehler: nicht bestätigt über Code und Text", () => {
  assert.deepEqual(anmeldeFehler({ message: "x", code: "email_not_confirmed" }), { art: "unbestaetigt" });
  assert.deepEqual(anmeldeFehler({ message: "Email not confirmed" }), { art: "unbestaetigt" });
});

test("anmeldeFehler: falsches Passwort und Unbekanntes auf Deutsch", () => {
  assert.deepEqual(anmeldeFehler({ message: "Invalid login credentials", code: "invalid_credentials" }), { art: "text", text: "E-Mail oder Passwort stimmt nicht." });
  const r = anmeldeFehler({ message: "Database error" });
  assert.equal(r.art, "text");
  assert.ok(r.art === "text" && !/database/i.test(r.text));
});

test("registrierFehler: Nutzername, E-Mail, Passwort", () => {
  assert.equal(registrierFehler({ message: "USERNAME_TAKEN" }).feld, "nutzername");
  // Vergebene E-Mail wird nicht verraten (AGENTS.md 3.6)
  const vergeben = registrierFehler({ message: "User already registered", code: "user_already_exists" });
  assert.equal(vergeben.feld, null);
  assert.ok(!/konto|vergeben|registriert/i.test(vergeben.text.replace("Das Konto konnte", "")));
  assert.equal(registrierFehler({ message: "", code: "weak_password" }).feld, "passwort");
  assert.equal(registrierFehler({ message: "boom" }).feld, null);
});

test("sendeFehler nennt die Wartezeit", () => {
  assert.match(sendeFehler({ message: "only request this after 42 seconds", status: 429 }), /42 Sekunden/);
});

test("adresse lässt leere Werte weg und kodiert", () => {
  assert.equal(adresse("/login", { bestaetigen: "1", email: "a+b@c.de", x: "" }), "/login?bestaetigen=1&email=a%2Bb%40c.de");
  assert.equal(adresse("/login", {}), "/login");
});

test("bestaetigenText", () => {
  assert.match(bestaetigenText("1", "lena@uni.de") ?? "", /an lena@uni.de unterwegs/);
  assert.match(bestaetigenText("offen", undefined) ?? "", /noch nicht bestätigt/);
  assert.equal(bestaetigenText(undefined, "x"), null);
});
