import { githubAlle } from "./team-update-github.mjs";
import { briefingAusKommentaren } from "./team-update-format.mjs";
import { aktuellesDeployment, datenbank, produktionsCommits } from "./team-update-produktion.mjs";

const umgebung = process.env;

async function katalog() {
  const bekannte = new Map();
  for (let offset = 0; ; offset += 500) {
    const antwort = await datenbank(umgebung, `team_update?select=pr,merge_sha&order=pr&limit=500&offset=${offset}`);
    const eintraege = await antwort.json();
    for (const eintrag of eintraege) bekannte.set(eintrag.merge_sha, eintrag.pr);
    if (eintraege.length < 500) return bekannte;
  }
}

const deployment = await aktuellesDeployment(umgebung);
const commits = produktionsCommits(umgebung.TEAM_UPDATE_START_SHA, deployment.sha);
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

if ((await aktuellesDeployment(umgebung)).id !== deployment.id) {
  throw new Error("Der Produktionsstand hat sich während des Abgleichs geändert.");
}

await datenbank(umgebung, "rpc/team_updates_abgleichen", {
  method: "POST",
  body: JSON.stringify({ eintraege, aktive_prs: aktive }),
});
console.log(`${eintraege.length} neue Briefings, ${aktive.length} aktive Einträge.`);
