export async function anfrage(url, token, optionen = {}) {
  const antwort = await fetch(url, {
    ...optionen,
    signal: AbortSignal.timeout(30_000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...optionen.headers },
  });
  if (!antwort.ok) throw new Error(`Dienst meldet HTTP ${antwort.status}.`);
  return antwort;
}

export async function github(pfad, optionen) {
  return anfrage(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${pfad}`, process.env.GH_TOKEN, optionen);
}

export async function githubAlle(pfad) {
  const daten = [];
  let seite = 1;
  while (true) {
    const antwort = await github(`${pfad}${pfad.includes("?") ? "&" : "?"}per_page=100&page=${seite++}`);
    daten.push(...await antwort.json());
    if (!antwort.headers.get("link")?.includes('rel="next"')) return daten;
  }
}
