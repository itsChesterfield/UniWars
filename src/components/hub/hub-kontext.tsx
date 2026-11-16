"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";
import type { Tables } from "@/lib/supabase/types";
import { ZEITZONE_BERLIN } from "@/lib/zeit";

const SYMBOL: Record<Bereich, string> = {
  uebersicht: "M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6",
  termine: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z|M4 10h16|M8 3v4|M16 3v4",
  aufgaben: "M9 6h11|M9 12h11|M9 18h11|m3.5 6 1 1 2-2|m3.5 12 1 1 2-2|m3.5 18 1 1 2-2",
  noten: "M4 20V10|M10 20V4|M16 20v-7|M22 20H2",
  fortschritt: "M3 17l5-5 4 4 8-9|M15 7h5v5",
  faecher: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
};

const MIT_FACHFILTER: Bereich[] = ["uebersicht", "termine", "aufgaben", "noten"];

function Symbol({ d }: { d: string }) {
  return (
    <svg className="i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const kurzDatum = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZEITZONE_BERLIN }).format(new Date(iso));

/**
 * Design B3: Kontextspalte des Zentralen Hubs (DESIGN.md Abschnitt 4 und 5).
 * Die Unterseiten standen vorher in einer Leiste über dem Inhalt (Notch). Dazu die nächsten Fristen und die Fächer.
 * Am Handy klappt dieselbe Navigation unter der Kopfleiste auf.
 */
export function HubKontext({
  aktiv,
  faecher,
  deadlines,
  pruefungen,
  mobil = false,
}: {
  aktiv: Bereich;
  faecher: Tables<"fach">[];
  deadlines: Tables<"deadline">[];
  pruefungen: Tables<"pruefung">[];
  mobil?: boolean;
}) {
  const pfad = usePathname();
  const fachId = useSearchParams().get("fachId");
  const fristen = [
    ...deadlines.filter((d) => !d.erledigt).map((d) => ({ ziel: `deadline:${d.id}`, titel: d.titel, wann: d.faellig_am, fachId: d.fach_id })),
    ...pruefungen.filter((p) => p.status === "ANSTEHEND").map((p) => ({ ziel: `pruefung:${p.id}`, titel: p.titel, wann: p.datum, fachId: p.fach_id as string | null })),
  ]
    .sort((a, b) => new Date(a.wann).getTime() - new Date(b.wann).getTime())
    .slice(0, 4);
  const filterZiel = MIT_FACHFILTER.includes(aktiv) && aktiv !== "uebersicht" ? pfad : "/aufgaben";

  const inhalt = (
    <>
      <nav className="kgruppe" aria-label="Zentraler Hub">
        <h3 className="gt">Zentraler Hub</h3>
        <ul className="kliste">
          {BEREICHE.map((b) => (
            <li key={b.bereich}>
              <Link
                href={fachId && MIT_FACHFILTER.includes(b.bereich) && b.bereich !== "uebersicht" ? `${b.href}?fachId=${encodeURIComponent(fachId)}` : b.href}
                className="keintrag"
                aria-current={b.bereich === aktiv ? "page" : undefined}
              >
                <Symbol d={SYMBOL[b.bereich]} />
                <span className="n">{b.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {fristen.length > 0 && (
        <section className="kgruppe" aria-label="Fristen">
          <h3 className="gt">Fristen</h3>
          <ul className="kliste">
            {fristen.map((f) => (
              <li key={f.ziel}>
                <Link href={`${pfad}?detail=${f.ziel}`} scroll={false} className="keintrag" style={{ "--c": faecher.find((x) => x.id === f.fachId)?.farbe ?? undefined } as React.CSSProperties}>
                  <span className="f" />
                  <span className="n">
                    {f.titel}
                    <small>{kurzDatum(f.wann)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {faecher.length > 0 && (
        <section className="kgruppe" aria-label="Fächer">
          <h3 className="gt">Fächer</h3>
          <ul className="kliste">
            {faecher.map((f) => (
              <li key={f.id}>
                <Link
                  href={fachId === f.id ? filterZiel : `${filterZiel}?fachId=${encodeURIComponent(f.id)}`}
                  className="keintrag"
                  aria-current={fachId === f.id ? "true" : undefined}
                  title={fachId === f.id ? "Filter aufheben" : `Aufgaben, Termine und Noten nach ${f.name} filtern`}
                  style={{ "--c": f.farbe ?? undefined } as React.CSSProperties}
                >
                  <span className="f" />
                  <span className="n">{f.name}</span>
                  {f.ects ? <span className="z">{f.ects} ECTS</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  if (mobil) {
    return (
      <details className="kontext-mobil" key={`${pfad}?${fachId ?? ""}`}>
        <summary>
          <span>
            Zentraler Hub<span className="km-ort"> · {BEREICHE.find((b) => b.bereich === aktiv)?.name}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="innen-k">{inhalt}</div>
      </details>
    );
  }
  return <aside className="kontext" aria-label="Bereiche des Zentralen Hubs">{inhalt}</aside>;
}
