import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { briefingAusKommentaren } from "./team-update-format.mjs";

test("Der Merge verlangt ein gültiges Briefing und einen einsatzbereiten Produktionsabgleich", async (t) => {
  const ordner = mkdtempSync(join(tmpdir(), "team-update-pr-"));
  const sha = "a".repeat(40);
  const event = join(ordner, "event.json");
  const liveSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  writeFileSync(event, JSON.stringify({ pull_request: { number: 9, head: { sha } } }));
  Object.assign(process.env, {
    GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "test/team", GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "1", GH_TOKEN: "token",
    TEAM_UPDATES_AKTIV: "true", TEAM_UPDATE_START_SHA: liveSha, TEAM_UPDATE_PRODUKTIONSHOST: "app.example.test",
    VERCEL_TEAM_ID: "team", VERCEL_PROJECT_ID: "projekt", VERCEL_TOKEN: "vercel-test",
    SUPABASE_URL: "https://db.example.test", SUPABASE_TEAM_UPDATES_KEY: "sb_secret_test",
  });
  t.after(() => { rmSync(ordner, { recursive: true, force: true }); process.exitCode = 0; });
  const briefing = { titel: "Einstellungen sind leichter erreichbar", punkte: ["Das Profilmenü öffnet die Einstellungen direkt."] };
  const block = (stand, text = briefing) => "\u0060\u0060\u0060team-update\n" + JSON.stringify({ stand, ...text }) + "\n\u0060\u0060\u0060";
  const status = [];
  const kommentare = [];
  let beschreibung = block(sha);
  let staende = 0;
  let geaendert = false;
  let nachtragen = false;
  let deploymentZiel = "production";
  let rpcSichtbar = true;
  let supabaseZugriff = true;
  let produktionsAnfragen = 0;
  t.mock.method(globalThis, "fetch", async (eingabe, optionen) => {
    const url = new URL(eingabe);
    if (url.hostname === "api.vercel.com") {
      produktionsAnfragen++;
      assert.equal(optionen.headers.Authorization, "Bearer vercel-test");
      assert.equal(optionen.redirect, "error");
      assert.equal(url.searchParams.get("teamId"), "team");
      if (url.pathname === "/v4/aliases/app.example.test") return Response.json({ projectId: "projekt", deploymentId: "deployment" });
      assert.equal(url.pathname, "/v13/deployments/deployment");
      return Response.json({ projectId: "projekt", target: deploymentZiel, readyState: "READY", gitSource: { sha: liveSha } });
    }
    if (url.hostname === "db.example.test") {
      produktionsAnfragen++;
      assert.equal(optionen.method ?? "GET", "GET");
      assert.equal(optionen.headers.apikey, "sb_secret_test");
      assert.equal(optionen.redirect, "error");
      if (url.pathname === "/rest/v1/team_update") {
        assert.equal(url.searchParams.get("select"), "pr,merge_sha");
        return Response.json([], { status: supabaseZugriff ? 200 : 403 });
      }
      assert.equal(url.pathname, "/rest/v1/");
      assert.equal(optionen.headers.Accept, "application/openapi+json");
      return Response.json({ paths: rpcSichtbar ? { "/rpc/team_updates_abgleichen": { post: {} } } : {} });
    }
    assert.equal(url.hostname, "api.github.com");
    if (url.pathname.endsWith(`/statuses/${sha}`)) {
      status.push(JSON.parse(optionen.body).state);
      return Response.json({});
    }
    if (url.pathname.endsWith("/pulls/9")) {
      staende++;
      return Response.json({
        state: nachtragen ? "closed" : "open",
        merged_at: nachtragen ? "2026-11-20T10:00:00Z" : null,
        base: { ref: "main" }, head: { sha: geaendert && staende === 2 ? "b".repeat(40) : sha },
        title: "Profilmenü", body: beschreibung,
      });
    }
    if (url.pathname.endsWith("/issues/9/comments")) {
      kommentare.push({ ...JSON.parse(optionen.body), user: { login: "github-actions[bot]" } });
      return Response.json({});
    }
    throw new Error(`Unerwartete Anfrage: ${url}`);
  });

  process.env.TEAM_UPDATES_AKTIV = "";
  await import("./team-update-pr.mjs?deaktiviert");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(produktionsAnfragen, 0);
  assert.equal(kommentare.length, 0);

  process.env.TEAM_UPDATES_AKTIV = "true";
  delete process.env.VERCEL_TOKEN;
  await import("./team-update-pr.mjs?secret-fehlt");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(produktionsAnfragen, 0);
  assert.equal(kommentare.length, 0);
  process.env.VERCEL_TOKEN = "vercel-test";

  deploymentZiel = "preview";
  await import("./team-update-pr.mjs?nur-preview");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 0);
  deploymentZiel = "production";

  supabaseZugriff = false;
  await import("./team-update-pr.mjs?supabase-ohne-zugriff");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 0);
  supabaseZugriff = true;

  rpcSichtbar = false;
  await import("./team-update-pr.mjs?rpc-fehlt");
  assert.deepEqual(status.slice(-2), ["pending", "failure"]);
  assert.equal(kommentare.length, 0);
  rpcSichtbar = true;

  await import("./team-update-pr.mjs?erfolgreich");
  assert.deepEqual(status.slice(-2), ["pending", "success"]);
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

  process.env.TEAM_UPDATES_AKTIV = "";
  geaendert = false;
  nachtragen = true;
  const vorherigeStatus = status.length;
  const vorherigeAnfragen = produktionsAnfragen;
  writeFileSync(event, JSON.stringify({ inputs: { pr: "9" } }));
  await import("./team-update-pr.mjs?nachtrag");
  assert.equal(status.length, vorherigeStatus);
  assert.equal(produktionsAnfragen, vorherigeAnfragen);
  assert.equal(kommentare.length, 3);
});
