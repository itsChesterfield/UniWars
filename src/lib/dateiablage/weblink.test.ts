import assert from "node:assert/strict";
import { test } from "node:test";
import { ablageDateiname, istWebLink, webLinkUrl } from "./weblink.ts";

test("Weblinks behalten ihren Zielabschnitt und ihre Freigabeparameter", () => {
  const ziel = "https://example.org/skript?ansicht=lesen#kapitel";
  assert.equal(webLinkUrl(ziel)?.href, ziel);
  assert.equal(webLinkUrl("javascript:alert(1)"), null);
  assert.equal(webLinkUrl("https://person:passwort@example.org"), null);
});

test("Eine normale Textdatei bleibt in der Ablage eine Textdatei", () => {
  const gespeichert = { speicher_pfad: "nutzer/weblinks/link.txt", mime_typ: "text/plain", name: "example.org.txt" };
  const datei = { ...gespeichert, speicher_pfad: "nutzer/allgemein/link.txt" };
  assert.equal(istWebLink(gespeichert), true);
  assert.equal(ablageDateiname(gespeichert), "example.org");
  assert.equal(istWebLink(datei), false);
  assert.equal(ablageDateiname(datei), "example.org.txt");
});
