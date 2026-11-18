import { requireAdmin } from "@/lib/rollen";
import { HubKopf } from "@/components/hubs/hub-bausteine";

export const metadata = { title: "Admin · UniVerse" };

/** Paket 2 (Plan docs/plaene/admin-passkey.md Abschnitt 4.2) baut diese Unterseiten. */
const UNTERSEITEN = [
  "Statistik",
  "Nutzerliste",
  "Rollen",
  "Sperren",
  "Feature-Flags",
  "Ankündigungen",
  "Fehler",
];

export default async function AdminSeite() {
  await requireAdmin();
  return (
    <>
      <HubKopf titel="Admin" untertitel="Verwaltung für Admins. Die Unterseiten entstehen in den nächsten Paketen." />
      <ul className="admin-tabs" aria-label="Unterseiten des Admin-Bereichs">
        {UNTERSEITEN.map((name) => (
          <li key={name}>
            <button type="button" className="btng" disabled>
              {name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
