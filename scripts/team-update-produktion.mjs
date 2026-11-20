import { execFileSync } from "node:child_process";
import { anfrage } from "./team-update-github.mjs";

const commitMuster = /^[a-f0-9]{40}$/;

export class ProduktionNichtBereit extends Error {}

export async function aktuellesDeployment(umgebung) {
  const abfrage = new URLSearchParams({ teamId: umgebung.VERCEL_TEAM_ID });
  const alias = encodeURIComponent(umgebung.TEAM_UPDATE_PRODUKTIONSHOST);
  const laden = async (pfad) => (
    await anfrage("https://api.vercel.com/" + pfad + "?" + abfrage, umgebung.VERCEL_TOKEN, { redirect: "error" })
  ).json();
  const domain = await laden("v4/aliases/" + alias);
  if (!domain.deploymentId || domain.projectId !== umgebung.VERCEL_PROJECT_ID) throw new Error("Produktionsdomain hat kein Deployment.");
  const deployment = await laden("v13/deployments/" + encodeURIComponent(domain.deploymentId));
  const sha = deployment.gitSource?.sha ?? deployment.meta?.githubCommitSha;
  if (deployment.projectId !== umgebung.VERCEL_PROJECT_ID || deployment.target !== "production" ||
      deployment.readyState !== "READY" || !commitMuster.test(sha ?? "")) {
    throw new Error("Produktionsdeployment konnte nicht bestätigt werden.");
  }
  return { id: domain.deploymentId, sha };
}

export function datenbank(umgebung, pfad, optionen = {}) {
  const token = umgebung.SUPABASE_TEAM_UPDATES_KEY;
  if (!token) throw new Error("SUPABASE_TEAM_UPDATES_KEY fehlt.");
  const basis = umgebung.SUPABASE_URL.replace(/\/$/, "");
  return anfrage(basis + "/rest/v1/" + pfad, token.startsWith("sb_secret_") ? null : token, {
    ...optionen, redirect: "error", headers: { ...optionen.headers, apikey: token },
  });
}

function ersteEltern(sha) {
  return execFileSync("git", ["rev-list", "--first-parent", sha, "--"], {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trim().split("\n");
}

export function produktionsCommits(start, live) {
  if (!commitMuster.test(start ?? "")) throw new Error("TEAM_UPDATE_START_SHA fehlt oder ist ungültig.");
  const verlauf = ersteEltern(live);
  const startIndex = verlauf.indexOf(start);
  if (startIndex >= 0) return verlauf.slice(0, startIndex).reverse();
  if (ersteEltern(start).includes(live)) return [];
  throw new Error("Produktionsstand liegt außerhalb des konfigurierten Verlaufs.");
}

export async function produktionPruefen(umgebung) {
  if (umgebung.TEAM_UPDATES_AKTIV?.toLowerCase() !== "true") {
    throw new ProduktionNichtBereit("Produktionsabgleich ist deaktiviert. GitHub-Variable TEAM_UPDATES_AKTIV auf true setzen.");
  }
  const felder = {
    TEAM_UPDATE_START_SHA: umgebung.TEAM_UPDATE_START_SHA,
    TEAM_UPDATE_PRODUKTIONSHOST: umgebung.TEAM_UPDATE_PRODUKTIONSHOST,
    TEAM_UPDATE_VERCEL_TEAM_ID: umgebung.VERCEL_TEAM_ID,
    TEAM_UPDATE_VERCEL_PROJECT_ID: umgebung.VERCEL_PROJECT_ID,
    TEAM_UPDATE_VERCEL_TOKEN: umgebung.VERCEL_TOKEN,
    TEAM_UPDATE_SUPABASE_URL: umgebung.SUPABASE_URL,
    TEAM_UPDATE_SUPABASE_KEY: umgebung.SUPABASE_TEAM_UPDATES_KEY,
  };
  const fehlt = Object.entries(felder).filter(([, wert]) => !wert?.trim()).map(([name]) => name);
  if (fehlt.length) throw new ProduktionNichtBereit("Produktionsabgleich unvollständig. In GitHub fehlt: " + fehlt.join(", ") + ".");
  if (!commitMuster.test(umgebung.TEAM_UPDATE_START_SHA)) {
    throw new ProduktionNichtBereit("TEAM_UPDATE_START_SHA muss den vollständigen Start-Commit enthalten.");
  }
  const supabase = URL.parse(umgebung.SUPABASE_URL);
  if (supabase?.protocol !== "https:" || supabase.href !== supabase.origin + "/") {
    throw new ProduktionNichtBereit("TEAM_UPDATE_SUPABASE_URL muss eine HTTPS-Basis-URL sein.");
  }

  const deployment = await aktuellesDeployment(umgebung).catch(() => {
    throw new ProduktionNichtBereit("Vercel-Produktion nicht erreichbar. Domain, Projekt und GitHub-Secret TEAM_UPDATE_VERCEL_TOKEN prüfen.");
  });
  try {
    produktionsCommits(umgebung.TEAM_UPDATE_START_SHA, deployment.sha);
  } catch {
    throw new ProduktionNichtBereit("TEAM_UPDATE_START_SHA und Vercel-Produktion liegen nicht auf derselben Hauptlinie.");
  }

  try {
    await datenbank(umgebung, "team_update?select=pr,merge_sha&limit=1");
    const schema = await datenbank(umgebung, "", { headers: { Accept: "application/openapi+json" } });
    if (!(await schema.json()).paths?.["/rpc/team_updates_abgleichen"]?.post) throw new Error("Abgleich fehlt.");
  } catch {
    throw new ProduktionNichtBereit("Supabase-Abgleich nicht verfügbar. Migration, REST-Zugriff und TEAM_UPDATE_SUPABASE_KEY prüfen.");
  }
}
