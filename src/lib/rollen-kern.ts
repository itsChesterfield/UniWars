/**
 * Rollen: user < moderator < admin (Plan docs/plaene/admin-passkey.md, Migration 20261118182307).
 * Ohne Next.js, testbar. Die Reihenfolge der Rollen entspricht dem Enum und darf nie geändert werden.
 */

/** Rolle eines Nutzers; ohne Zeile in user_roles gilt 'user'. */
export type Rolle = "user" | "moderator" | "admin";

/** Rollen mehrerer Nutzer aus den gelesenen Zeilen aufbauen; fehlende IDs bekommen 'user'. */
export function rollenAusZeilen(zeilen: { user_id: string; role: Rolle }[], ids: string[]): Map<string, Rolle> {
  const gelesen = new Map(zeilen.map((zeile) => [zeile.user_id, zeile.role]));
  return new Map(ids.map((id) => [id, gelesen.get(id) ?? "user"]));
}

/**
 * Kern von requireAdminAction: wirft, wenn die Rolle nicht 'admin' ist oder niemand angemeldet ist.
 * Server Actions und Route Handler fangen den Fehler und antworten ohne Details.
 */
export function adminErfordern(rolle: Rolle | null, userId: string | null): { userId: string } {
  if (!userId) throw new Error("Nicht erlaubt");
  if (rolle !== "admin") throw new Error("Nicht erlaubt");
  return { userId };
}
