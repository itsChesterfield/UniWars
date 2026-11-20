import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { briefingAusKommentaren } from "./team-update-format.mjs";

test("PR-Briefing ist Pflicht und muss zum aktuellen Commit passen", async (t) => {
  const ordner = mkdtempSync(join(tmpdir(), "team-update-pr-"));
  const sha = "a".repeat(40);
  const event = join(ordner, "event.json");
  writeFileSync(event, JSON.stringify({ pull_request: { number: 9, head: { sha } } }));
  Object.assign(process.env, {
    GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "test/team", GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "1", GH_TOKEN: "token",
  });
  t.after(() => { rmSync(ordner, { recursive: true, force: true }); process.exitCode = 0; });
  const briefing = { titel: "Einstellungen sind leichter erreichbar", punkte: ["Das Profilmenü öffnet die Einstellungen direkt."] };
  const block = (stand, text = briefing) => "\u0060\u0060\u0060team-update\n" + JSON.stringify({ stand, ...text }) + "\n\u0060\u0060\u0060";
  const status = [];
  const kommentare = [];
  let beschreibung = block(sha);
  let staende = 0;
  let geaendert = false;
  t.mock.method(globalThis, "fetch", async (eingabe, optionen) => {
    const url = new URL(eingabe);
    assert.equal(url.hostname, "api.github.com");
    if (url.pathname.endsWith(`/statuses/${sha}`)) {
      status.push(JSON.parse(optionen.body).state);
      return Response.json({});
    }
    if (url.pathname.endsWith("/pulls/9")) {
      staende++;
      return Response.json({
        state: "open", head: { sha: geaendert && staende === 2 ? "b".repeat(40) : sha },
        title: "Profilmenü", body: beschreibung,
      });
    }
    if (url.pathname.endsWith("/issues/9/comments")) {
      kommentare.push({ ...JSON.parse(optionen.body), user: { login: "github-actions[bot]" } });
      return Response.json({});
    }
    throw new Error(`Unerwartete Anfrage: ${url}`);
  });
  await import("./team-update-pr.mjs?erfolgreich");
  assert.deepEqual(status, ["pending", "success"]);
  assert.deepEqual(briefingAusKommentaren(kommentare, sha), briefing);

  for (const [fall, text] of [
    ["fehlend", "Ohne Briefing"],
    ["veraltet", block("b".repeat(40))],
    ["formfehler", block(sha, { ...briefing, punkte: ["<script>"] })],
    ["doppelt", block(sha) + "\n\n" + block(sha)],
  ]) {
    beschreibung = text;
    await import(`./team-update-pr.mjs?${fall}`);
    assert.deepEqual(status.slice(-2), ["pending", "failure"], fall);
    assert.equal(kommentare.length, 1);
  }

  beschreibung = block(sha).replaceAll("\n", "\r\n");
  await import("./team-update-pr.mjs?windows-zeilen");
  assert.deepEqual(status.slice(-2), ["pending", "success"]);
  assert.equal(kommentare.length, 2);

  geaendert = true;
  staende = 0;
  await import("./team-update-pr.mjs?geaenderter-stand");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 2);
});
