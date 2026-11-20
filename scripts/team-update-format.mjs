function zeile(wert, limit, fett) {
  if (typeof wert !== "string" || !wert.trim() || [...wert].length > limit ||
      /[\p{Cc}\p{Cf}<>\[\]`]|https?:\/\/|\b(?:Bearer\s+|sk-[A-Za-z0-9]|gh[pousr]_|eyJ[A-Za-z0-9_-]{15,}\.)/iu.test(wert)) {
    throw new Error("Briefing enthält eine ungültige oder sensible Zeile.");
  }
  const rest = fett ? wert.replace(/\*\*[^*\n]+\*\*/g, "") : wert;
  if (rest.includes("*")) throw new Error("Briefing enthält fehlerhaften Fettdruck.");
  return wert.trim();
}

export function briefingPruefen(eingabe) {
  if (!eingabe || !Array.isArray(eingabe.punkte) || eingabe.punkte.length < 1 || eingabe.punkte.length > 3) {
    throw new Error("Briefing braucht ein bis drei Punkte.");
  }
  return { titel: zeile(eingabe.titel, 100, false), punkte: eingabe.punkte.map((punkt) => zeile(punkt, 220, true)) };
}

export function briefingKommentar(sha, briefing) {
  const { titel, punkte } = briefingPruefen(briefing);
  const daten = Buffer.from(JSON.stringify({ titel, punkte })).toString("base64");
  return `<!-- team-update:${sha}:${daten} -->\n## Team-Update\n\n**${titel}**\n\n${punkte.map((punkt) => `- ${punkt}`).join("\n")}`;
}

export function briefingAusKommentaren(kommentare, sha) {
  for (const kommentar of [...kommentare].reverse()) {
    if (kommentar.user?.login !== "github-actions[bot]") continue;
    const match = kommentar.body?.match(/^<!-- team-update:([a-f0-9]{40}):([A-Za-z0-9+/=]+) -->/);
    if (match?.[1] === sha) return briefingPruefen(JSON.parse(Buffer.from(match[2], "base64").toString()));
  }
  return null;
}
