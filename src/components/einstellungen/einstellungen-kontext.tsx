"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SEITEN: { href: string; name: string; icon: string; nurMitKi?: boolean; nurTeam?: boolean }[] = [
  {
    href: "/einstellungen",
    name: "Profil und Konto",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z|M4.5 20.5a7.5 7.5 0 0 1 15 0",
  },
  {
    href: "/einstellungen/personalisierung",
    name: "Personalisierung",
    icon: "M4 4h7v7H4Z|M13 4h7v7h-7Z|M4 13h16v7H4Z",
  },
  {
    href: "/einstellungen/gedaechtnis",
    name: "Studio und Gedächtnis",
    icon: "M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8Z",
    nurMitKi: true,
  },
  {
    href: "/einstellungen/team-updates",
    name: "Team-Updates",
    icon: "M5 4h14v16H5z|M8 8h8|M8 12h8|M8 16h5",
    nurTeam: true,
  },
];

function Symbol({ d }: { d: string }) {
  return (
    <svg className="i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/**
 * Design B3: Kontextspalte der Einstellungen (DESIGN.md Abschnitt 4 und 6).
 * Steht im Rahmen aller Hubs und zeigt sich nur unter /einstellungen. Am Handy klappt sie unter der Kopfleiste auf.
 */
export function EinstellungenKontext({ mobil = false, kiVerfuegbar = true, team = false }: { mobil?: boolean; kiVerfuegbar?: boolean; team?: boolean }) {
  const pfad = usePathname();
  if (!pfad.startsWith("/einstellungen")) return null;
  const seiten = SEITEN.filter((s) => (kiVerfuegbar || !s.nurMitKi) && (team || !s.nurTeam));
  const aktiv = seiten.find((s) => s.href === pfad) ?? seiten[0];

  const liste = (
    <nav className="kgruppe" aria-label="Einstellungen">
      <h3 className="gt">Einstellungen</h3>
      <ul className="kliste">
        {seiten.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="keintrag" aria-current={s === aktiv ? "page" : undefined}>
              <Symbol d={s.icon} />
              <span className="n">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (mobil) {
    return (
      <details className="kontext-mobil einst-kontext-mobil" key={pfad}>
        <summary>
          <span>
            Einstellungen<span className="km-ort">, {aktiv.name}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="innen-k">{liste}</div>
      </details>
    );
  }
  return (
    <aside className="kontext" aria-label="Bereiche der Einstellungen">
      {liste}
    </aside>
  );
}
