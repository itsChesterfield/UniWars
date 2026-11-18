import type { Rolle } from "@/lib/rollen-kern";

/**
 * Rollen-Schild neben dem Namen (Plan Paket 1.5): Admin rot mittels Fehler-Token,
 * Mod gelb mittels Warn-Token. Für 'user' wird nichts gerendert.
 * Echter Text, nicht dekorativ: Screenreader lesen „Admin“ beziehungsweise „Mod“.
 */
export function RollenBadge({ rolle }: { rolle: Rolle }) {
  if (rolle === "user") return null;
  return (
    <span className="rollen-badge" data-rolle={rolle}>
      {rolle === "admin" ? "Admin" : "Mod"}
    </span>
  );
}
