import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { briefingAusKommentaren } from "./team-update-format.mjs";

test("KI-Entwurf wird erst nach Validierung zum geprüften PR-Stand gespeichert", async (t) => {
  const ordner = mkdtempSync(join(tmpdir(), "team-update-pr-"));
  const sha = "a".repeat(40);
  const event = join(ordner, "event.json");
  writeFileSync(event, JSON.stringify({ pull_request: { number: 9, head: { sha } } }));
  Object.assign(process.env, {
    GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "test/team", GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "1", GH_TOKEN: "token", MISTRAL_API_KEY: "test-key",
  });
  t.after(() => { rmSync(ordner, { recursive: true, force: true }); process.exitCode = 0; });
  const briefing = { titel: "Einstellungen sind leichter erreichbar", punkte: ["Das Profilmenü öffnet die Einstellungen direkt."] };
  const status = [];
  const kommentare = [];
  let modellVerfuegbar = true;
  let staende = 0;
  let geaendert = false;
  t.mock.method(globalThis, "fetch", async (eingabe, optionen) => {
    const url = new URL(eingabe);
    if (url.pathname.endsWith(`/statuses/${sha}`)) {
      status.push(JSON.parse(optionen.body).state);
      return Response.json({});
    }
    if (url.pathname.endsWith("/pulls/9")) {
      staende++;
      return Response.json({
        state: "open", head: { sha: geaendert && staende === 2 ? "b".repeat(40) : sha },
        title: "Profilmenü", body: "API_KEY: nicht-an-das-modell-senden\nDas Menü wurde überarbeitet.",
      });
    }
    if (url.pathname.endsWith("/pulls/9/files")) return Response.json([{ filename: "src/profil.tsx", status: "modified" }]);
    if (url.hostname === "api.mistral.ai") {
      assert.doesNotMatch(optionen.body, /nicht-an-das-modell-senden/);
      if (!modellVerfuegbar) return new Response(null, { status: 503 });
      return Response.json({ choices: [{ message: { content: JSON.stringify(briefing) } }] });
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

  modellVerfuegbar = false;
  await import("./team-update-pr.mjs?ki-ausfall");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 1);

  modellVerfuegbar = true;
  geaendert = true;
  staende = 0;
  await import("./team-update-pr.mjs?geaenderter-stand");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 1);
});
