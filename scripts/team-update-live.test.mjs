import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { briefingKommentar } from "./team-update-format.mjs";

test("Produktionsabgleich bündelt Merges, ignoriert Vorschauen und verarbeitet Rollbacks", async (t) => {
  const ordner = mkdtempSync(join(tmpdir(), "team-updates-"));
  const vorher = process.cwd();
  t.after(() => { process.chdir(vorher); rmSync(ordner, { recursive: true, force: true }); });
  process.chdir(ordner);
  const git = (...args) => execFileSync("git", ["-c", "user.name=Tests", "-c", "user.email=test@example.test", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init");
  const commit = (titel) => {
    git("commit", "--allow-empty", "-m", titel);
    return git("rev-parse", "HEAD");
  };
  const start = commit("Start");
  const eins = commit("PR 1");
  const zwei = commit("PR 2");
  const head = "a".repeat(40);
  const briefing = { titel: "Leichter zu finden", punkte: ["Die Seite ist direkt erreichbar."] };
  Object.assign(process.env, {
    TEAM_UPDATE_START_SHA: start, TEAM_UPDATE_PRODUKTIONSHOST: "app.example.test", VERCEL_PROJECT_ID: "projekt",
    VERCEL_TEAM_ID: "team", VERCEL_TOKEN: "token", GITHUB_REPOSITORY: "test/team",
    SUPABASE_URL: "https://db.example.test", SUPABASE_TEAM_UPDATES_KEY: "sb_secret_test", GH_TOKEN: "token",
  });

  const katalog = [];
  const abgleiche = [];
  let live = zwei;
  let target = "production";
  let wechseln = false;
  let geladenePrs = 0;
  t.mock.method(globalThis, "fetch", async (eingabe, optionen) => {
    const url = new URL(eingabe);
    const pfad = url.pathname;
    if (pfad.includes("/aliases/")) return Response.json({ projectId: "projekt", deploymentId: live });
    if (pfad.includes("/deployments/")) return Response.json({ projectId: "projekt", target, readyState: "READY", gitSource: { sha: pfad.split("/").at(-1) } });
    if (pfad.endsWith("/team_update")) {
      assert.equal(optionen.headers.Authorization, undefined);
      assert.equal(optionen.headers.apikey, "sb_secret_test");
      if (wechseln) live = eins;
      return Response.json(katalog);
    }
    if (pfad.endsWith("/pulls")) {
      geladenePrs++;
      const sha = pfad.split("/").at(-2);
      return Response.json([{
        number: sha === eins ? 1 : 2, merged_at: "2026-11-20T10:00:00Z", merge_commit_sha: sha,
        head: { sha: head }, base: { ref: "main", repo: { full_name: "test/team" } },
      }]);
    }
    if (pfad.endsWith("/comments")) return Response.json([{ user: { login: "github-actions[bot]" }, body: briefingKommentar(head, briefing) }]);
    if (pfad.endsWith("/rpc/team_updates_abgleichen")) {
      const daten = JSON.parse(optionen.body);
      abgleiche.push(daten);
      katalog.push(...daten.eintraege);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unerwartete Anfrage: ${url}`);
  });

  const abgleichen = (fall) => import(`./team-update-live.mjs?${fall}`);
  target = null;
  await assert.rejects(abgleichen("preview"), /Produktionsdeployment/);
  assert.equal(abgleiche.length, 0);
  target = "production";
  wechseln = true;
  await assert.rejects(abgleichen("wechsel"), /während des Abgleichs/);
  assert.equal(abgleiche.length, 0);
  wechseln = false;
  live = zwei;
  await abgleichen("buendel");
  assert.deepEqual(abgleiche.at(-1).aktive_prs, [1, 2]);
  assert.equal(abgleiche.at(-1).eintraege.length, 2);
  const anzahl = geladenePrs;
  await abgleichen("wiederholung");
  assert.deepEqual(abgleiche.at(-1).eintraege, []);
  assert.equal(geladenePrs, anzahl);
  live = eins;
  await abgleichen("rollback");
  assert.deepEqual(abgleiche.at(-1).aktive_prs, [1]);
  live = zwei;
  await abgleichen("reaktivierung");
  assert.deepEqual(abgleiche.at(-1).aktive_prs, [1, 2]);
  assert.equal(katalog.length, 2);
});
