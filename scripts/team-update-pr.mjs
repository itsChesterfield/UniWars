import { readFile } from "node:fs/promises";
import { github } from "./team-update-github.mjs";
import { briefingKommentar, briefingPruefen } from "./team-update-format.mjs";

const ereignis = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const nachtragen = ereignis.pull_request == null;
const nummer = ereignis.pull_request?.number ?? Number(ereignis.inputs?.pr);
if (!Number.isSafeInteger(nummer) || nummer < 1) throw new Error("Ungültige PR-Nummer.");
const pullRequest = async () => (await github(`pulls/${nummer}`)).json();
const sha = ereignis.pull_request?.head.sha ?? (await pullRequest()).head.sha;
const gueltigerStand = (stand) => stand.head.sha === sha &&
  (nachtragen
    ? stand.state === "closed" && stand.merged_at && stand.base?.ref === "main"
    : stand.state === "open");
const status = (state, description) => github(`statuses/${sha}`, {
  method: "POST",
  body: JSON.stringify({ state, description, context: "Team-Update / Briefing", target_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` }),
});

await status("pending", "Briefing wird geprüft");
try {
  const aktuell = await pullRequest();
  if (!gueltigerStand(aktuell)) throw new Error("stand_geaendert");
  const bloecke = [...(aktuell.body ?? "").matchAll(/^```team-update[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm)];
  if (bloecke.length !== 1) throw new Error("block_fehlt");
  const daten = JSON.parse(bloecke[0][1]);
  if (daten?.stand !== sha) throw new Error("stand_veraltet");
  const briefing = briefingPruefen(daten);
  const letzte = await pullRequest();
  if (!gueltigerStand(letzte) || letzte.body !== aktuell.body || letzte.title !== aktuell.title) {
    throw new Error("stand_geaendert");
  }
  await github(`issues/${nummer}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: briefingKommentar(sha, briefing) }),
  });
  await status("success", "Briefing für diesen Stand liegt vor");
} catch (fehler) {
  const hinweis = {
    block_fehlt: "Genau einen team-update-Block in der PR-Beschreibung ergänzen.",
    stand_veraltet: "Briefing prüfen und mit dem aktuellen vollständigen PR-Commit kennzeichnen.",
    stand_geaendert: "Der Pull Request wurde während der Prüfung geändert.",
  }[fehler?.message] ?? "Briefing-Format oder Verarbeitung ungültig. Pull Request prüfen.";
  console.error(hinweis);
  await status("failure", hinweis);
  process.exitCode = 1;
}
