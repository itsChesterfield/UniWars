type DbFehler = { code?: string; message?: string } | null | undefined;

// Tabelle/Spalte existiert (noch) nicht – z. B. weil eine Migration fehlt.
export function tabelleFehlt(fehler: DbFehler): boolean {
  if (!fehler) return false;
  if (fehler.code === "PGRST205" || fehler.code === "42P01" || fehler.code === "42703") return true;
  return /does not exist|schema cache/i.test(fehler.message ?? "");
}
