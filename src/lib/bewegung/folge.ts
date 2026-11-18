/**
 * Feste Reihenfolge beim Abhaken: Solange der Zeiger oder der Fokus in der Liste ist, bleibt jede Zeile an ihrem Platz
 * (Erledigte rutschen nicht unter dem Zeiger weg). Neue Einträge kommen an ihren sortierten Platz, entfernte fallen weg.
 * `stand` ist die Reihenfolge beim Betreten der Liste, `null` heißt: nicht festhalten.
 */
export function festeFolge(stand: string[] | null, sortiert: string[]): string[] {
  if (!stand) return sortiert;
  const da = new Set(sortiert);
  const fest = stand.filter((id) => da.has(id));
  const bekannt = new Set(fest);
  for (const [i, id] of sortiert.entries()) {
    if (bekannt.has(id)) continue;
    // Neuer Eintrag: hinter seinen sortierten Vorgänger setzen
    const vorgaenger = sortiert.slice(0, i).reverse().find((v) => bekannt.has(v));
    fest.splice(vorgaenger ? fest.indexOf(vorgaenger) + 1 : 0, 0, id);
    bekannt.add(id);
  }
  return fest;
}
