"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { dokumentAnlegen, dokumentLoeschen } from "@/app/(hubs)/textverarbeitung/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

type Eintrag = { id: string; titel: string; fach_id: string | null; woerter: number; geaendert_am: string };

export const OHNE_TITEL = "Unbenanntes Dokument";

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** TXT-01 + ALL-04/06/07: Übersicht aller Dokumente. */
export function DokumentListe({ dokumente, faecher }: { dokumente: Eintrag[]; faecher: FachOption[] }) {
  const router = useRouter();
  const fachFilter = useSearchParams().get("fachId");
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const sichtbar = dokumente.filter((d) => !fachFilter || d.fach_id === fachFilter);

  function neu() {
    setFehler(null);
    track("dokument_angelegt", { mit_fach: Boolean(fachFilter) });
    startTransition(async () => {
      try {
        const id = await dokumentAnlegen(fachFilter);
        router.push(`/textverarbeitung/${id}?neu=1`);
      } catch (err) {
        setFehler("Dokument konnte nicht angelegt werden.");
        fehlerMelden(err, { ort: "dokument_anlegen" });
      }
    });
  }

  async function loeschen(d: Eintrag) {
    if (!window.confirm(`„${d.titel || OHNE_TITEL}“ wirklich löschen?`)) return;
    try {
      await dokumentLoeschen(d.id);
      track("dokument_geloescht");
      router.refresh();
    } catch (err) {
      fehlerMelden(err, { ort: "dokument_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  const neuKnopf = (
    <button type="button" className="btnp" onClick={neu} disabled={isPending}>
      + Neues Dokument
    </button>
  );

  return (
    <>
      <HubKopf titel="Textverarbeitung" untertitel="Hausarbeiten, Protokolle und andere lange Texte – mit Export als PDF oder Word." aktionen={neuKnopf} />
      <FachFilterChips faecher={faecher} />
      {fehler && <p className="auth-error">{fehler}</p>}

      {dokumente.length === 0 ? (
        <LeererZustand
          icon="📄"
          text="Noch keine Dokumente. Starte deine Hausarbeit oder dein nächstes Protokoll."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={neu} disabled={isPending}>
              + Erstes Dokument anlegen
            </button>
          }
        />
      ) : sichtbar.length === 0 ? (
        <p className="empty-state">Für dieses Fach gibt es noch kein Dokument.</p>
      ) : (
        <section className="card">
          <ul className="pdf-liste">
            {sichtbar.map((d) => {
              const fach = faecher.find((f) => f.id === d.fach_id);
              return (
                <li key={d.id} className="txt-liste-zeile">
                  <Link href={`/textverarbeitung/${d.id}`} className="pdf-liste-zeile">
                    <span aria-hidden>📄</span>
                    <span className={`pdf-liste-name ${d.titel ? "" : "faint"}`}>{d.titel || OHNE_TITEL}</span>
                    <span className="muted pdf-liste-fach">
                      {fach ? (
                        <>
                          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                        </>
                      ) : (
                        "Ohne Fach"
                      )}
                    </span>
                    <span className="faint mono">{d.woerter.toLocaleString("de-DE")} Wörter</span>
                    <span className="faint">{datum(d.geaendert_am)}</span>
                  </Link>
                  <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: () => void loeschen(d), gefahr: true }]} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
