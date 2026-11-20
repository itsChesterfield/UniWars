import { execFileSync } from "node:child_process";
import { anfrage, githubAlle } from "./team-update-github.mjs";
import { briefingAusKommentaren } from "./team-update-format.mjs";

const umgebung = process.env;
const commitMuster = /^[a-f0-9]{40}$/;
const start = umgebung.TEAM_UPDATE_START_SHA;
if (!commitMuster.test(start ?? "")) throw new Error("TEAM_UPDATE_START_SHA fehlt oder ist ungültig.");

async function aktuellesDeployment() {
  const abfrage = new URLSearchParams({ teamId: umgebung.VERCEL_TEAM_ID });
  const alias = encodeURIComponent(umgebung.TEAM_UPDATE_PRODUKTIONSHOST);
  const laden = async (pfad) => (await anfrage(`https://api.vercel.com/${pfad}?${abfrage}`, umgebung.VERCEL_TOKEN)).json();
  const domain = await laden(`v4/aliases/${alias}`);
  if (!domain.deploymentId || domain.projectId !== umgebung.VERCEL_PROJECT_ID) throw new Error("Produktionsdomain hat kein Deployment.");
  const deployment = await laden(`v13/deployments/${encodeURIComponent(domain.deploymentId)}`);
  const sha = deployment.gitSource?.sha ?? deployment.meta?.githubCommitSha;
  if (deployment.projectId !== umgebung.VERCEL_PROJECT_ID || deployment.target !== "production" ||
      deployment.readyState !== "READY" || !commitMuster.test(sha ?? "")) {
    throw new Error("Produktionsdeployment konnte nicht bestätigt werden.");
  }
  return { id: domain.deploymentId, sha };
}

function git(...argumente) {
  return execFileSync("git", argumente, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
}

async function katalog() {
  const bekannte = new Map();
  for (let offset = 0; ; offset += 500) {
    const antwort = await datenbank(`team_update?select=pr,merge_sha&order=pr&limit=500&offset=${offset}`);
    const eintraege = await antwort.json();
    for (const eintrag of eintraege) bekannte.set(eintrag.merge_sha, eintrag.pr);
    if (eintraege.length < 500) return bekannte;
  }
}

function datenbank(pfad, optionen = {}) {
  const token = umgebung.SUPABASE_TEAM_UPDATES_KEY;
  if (!token) throw new Error("SUPABASE_TEAM_UPDATES_KEY fehlt.");
  return anfrage(`${umgebung.SUPABASE_URL}/rest/v1/${pfad}`, token.startsWith("sb_secret_") ? null : token, {
    ...optionen, headers: { apikey: token },
  });
}

const deployment = await aktuellesDeployment();
const ersteEltern = git("rev-list", "--first-parent", deployment.sha, "--").split("\n");
const startIndex = ersteEltern.indexOf(start);
if (startIndex < 0 && !git("rev-list", "--first-parent", start, "--").split("\n").includes(deployment.sha)) {
  throw new Error("Produktionsstand liegt außerhalb des konfigurierten Verlaufs.");
}
const commits = startIndex < 0 ? [] : ersteEltern.slice(0, startIndex).reverse();
const bekannte = await katalog();
const eintraege = [];
const aktive = [];

for (const sha of commits) {
  const bekannt = bekannte.get(sha);
  if (bekannt) {
    aktive.push(bekannt);
    continue;
  }
  const prs = await githubAlle(`commits/${sha}/pulls`);
  const pr = prs.find((kandidat) => kandidat.merged_at && kandidat.merge_commit_sha === sha &&
    kandidat.base?.ref === "main" && kandidat.base?.repo?.full_name === umgebung.GITHUB_REPOSITORY);
  if (!pr) throw new Error(`Für Produktionscommit ${sha} fehlt der Pull Request.`);
  const kommentare = await githubAlle(`issues/${pr.number}/comments`);
  const briefing = briefingAusKommentaren(kommentare, pr.head.sha);
  if (!briefing) throw new Error(`Das geprüfte Team-Briefing für PR #${pr.number} fehlt.`);
  aktive.push(pr.number);
  eintraege.push({ pr: pr.number, merge_sha: sha, aktualisiert_am: pr.merged_at, ...briefing });
}

if ((await aktuellesDeployment()).id !== deployment.id) {
  throw new Error("Der Produktionsstand hat sich während des Abgleichs geändert.");
}

await datenbank("rpc/team_updates_abgleichen", {
  method: "POST",
  body: JSON.stringify({ eintraege, aktive_prs: aktive }),
});
console.log(`${eintraege.length} neue Briefings, ${aktive.length} aktive Einträge.`);
