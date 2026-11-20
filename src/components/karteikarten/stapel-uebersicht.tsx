"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { stapelAnlegen, stapelBearbeiten, stapelLoeschen, type Stapel } from "@/app/(hubs)/karteikarten/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { StapelDialog } from "@/components/karteikarten/stapel-dialog";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { inDenPapierkorb } from "@/components/rueckfrage";
import { kartenLage } from "@/lib/bereichskopf";
import { meldung } from "@/components/meldung";

export type StapelKachel = Stapel & { anzahl: number; faellig: number };

export type KartenVorschlag = { stapelId: string; gruende: string[] };

const farbe = (f: FachOption | null) => ({ "--c": f?.farbe ?? "var(--text-3)" }) as CSSProperties;
const karten = (n: number) => `${n} ${n === 1 ? "Karte" : "Karten"}`;

export function StapelUebersicht({
  stapel,
  faecher,
  vorschlaege = [],
}: {
  stapel: StapelKachel[];
  faecher: FachOption[];
  /** Was sich jetzt zu lernen lohnt (fällig, Prüfung, Vorlesung) */
  vorschlaege?: KartenVorschlag[];
}) {
  const router = useRouter();
  const fachFilter = useSearchParams().get("fachId");
  const [dialog, setDialog] = useState<{ modus: "neu" } | { modus: "bearbeiten"; stapel: StapelKachel } | null>(null);

  const sichtbar = stapel.filter((s) => !fachFilter || s.fach_id === fachFilter);
  const fachVon = (id: string | null) => faecher.find((f) => f.id === id) ?? null;
  const faellig = stapel.reduce((n, s) => n + s.faellig, 0);
  const mitFaelligen = stapel.filter((s) => s.faellig > 0).length;

  async function loeschen(s: StapelKachel, bestaetigt = false) {
    const hinweis = s.anzahl > 0 ? ` mit ${karten(s.anzahl)}` : "";
    if (!bestaetigt && !(await inDenPapierkorb(`Der Stapel „${s.name}“${hinweis}`))) return;
    try {
      await stapelLoeschen(s.id);
      track("kk_stapel_geloescht", { karten: s.anzahl });
      router.refresh();
    } catch (err) {
      fehlerMelden(err, { ort: "kk_stapel_loeschen" });
      meldung("Löschen hat nicht geklappt.", "fehler", () => loeschen(s, true));
    }
  }

  const neu = (klasse: string, text: string) => (
    <button type="button" className={`knopf ${klasse}`} onClick={() => setDialog({ modus: "neu" })}>
      <Icon name="plus" groesse={16} />
      {text}
    </button>
  );

  return (
    <>
      <Bereichskopf
        titel="Karteikarten"
        zahl={stapel.length ? faellig : undefined}
        einheit={faellig === 1 ? "Karte fällig heute" : "Karten fällig heute"}
        lage={stapel.length ? kartenLage(stapel) : null}
        untertitel={
          faellig > 0
            ? `Aus ${mitFaelligen} ${mitFaelligen === 1 ? "Stapel" : "Stapeln"}. Fällige Karten kommen automatisch wieder.`
            : "Lernen mit Wiederholung: Fällige Karten kommen automatisch wieder."
        }
        aktionen={stapel.length > 0 ? neu("haupt", "Neuer Stapel") : undefined}
      />
      <FachFilterChips faecher={faecher} />

      {vorschlaege.length > 0 && !fachFilter && (
        <section className="kk-abschnitt" aria-labelledby="kk-jetzt">
          <div className="abschnitt-kopf">
            <h2 id="kk-jetzt" className="abschnitt-titel">
              Jetzt lernen
            </h2>
            <span className="abschnitt-info">nach Wiederholung, Prüfungen und Vorlesungen</span>
          </div>
          <ul className="entry-list">
            {vorschlaege.map((v) => {
              const s = stapel.find((x) => x.id === v.stapelId);
              if (!s) return null;
              return (
                <li key={v.stapelId} className="entry-row fach-zeile">
                  <span className="fach-farbe" style={farbe(fachVon(s.fach_id))} aria-hidden />
                  <div className="entry-info">
                    <span className="entry-title">{s.name}</span>
                    <span className="entry-meta">{v.gruende.join(", ")}</span>
                  </div>
                  <Link
                    href={`/karteikarten/${s.id}/lernen`}
                    className="knopf neben klein"
                    onClick={() => track("kk_vorschlag_geoeffnet", { faellig: s.faellig, gruende: v.gruende.length })}
                  >
                    Lernen{s.faellig > 0 && <span className="zahl">{s.faellig}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="kk-abschnitt" aria-labelledby="kk-stapel">
        <div className="abschnitt-kopf">
          <h2 id="kk-stapel" className="abschnitt-titel">
            Stapel
          </h2>
          {sichtbar.length > 0 && <span className="abschnitt-info">{sichtbar.length}</span>}
        </div>
        {stapel.length === 0 ? (
          <Zustand art="leer" icon="karteikarten" titel="Noch keine Stapel." region ebene={3} aktion={neu("neben klein", "Stapel anlegen")}>
            Leg einen Stapel pro Thema an, zum Beispiel „Mathe 1, Definitionen“. Fällige Karten kommen dann automatisch wieder.
          </Zustand>
        ) : sichtbar.length === 0 ? (
          <Zustand art="leer" icon="karteikarten" titel="In diesem Fach gibt es noch keinen Stapel." region ebene={3} aktion={neu("neben klein", "Stapel anlegen")} />
        ) : (
          <ul className="entry-list">
            {sichtbar.map((s) => {
              const fach = fachVon(s.fach_id);
              return (
                <li key={s.id} className="entry-row fach-zeile">
                  <span className="fach-farbe" style={farbe(fach)} aria-hidden />
                  <div className="entry-info">
                    <Link href={`/karteikarten/${s.id}`} className="entry-title kk-name">
                      {s.name}
                    </Link>
                    <span className="entry-meta">
                      {fach?.name ?? "Ohne Fach"}, {karten(s.anzahl)}
                    </span>
                  </div>
                  <span className={`kk-faellig${s.faellig > 0 ? " an" : ""}`}>
                    <span className="zahl">{s.faellig}</span> fällig
                  </span>
                  <div className="entry-actions">
                    {s.anzahl > 0 && (
                      <Link href={`/karteikarten/${s.id}/lernen`} className="knopf neben klein">
                        Lernen
                      </Link>
                    )}
                    <DreiPunkteMenue
                      label={`Weitere Aktionen für ${s.name}`}
                      punkte={[
                        { label: "Bearbeiten", onClick: () => setDialog({ modus: "bearbeiten", stapel: s }) },
                        { label: "In den Papierkorb", onClick: () => void loeschen(s), gefahr: true },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog?.modus === "neu" && (
        <StapelDialog
          titel="Neuer Stapel"
          knopf="Anlegen"
          faecher={faecher}
          startFachId={fachFilter}
          onSchliessen={() => setDialog(null)}
          onSpeichern={async (name, fachId) => {
            const neu = await stapelAnlegen(name, fachId);
            track("kk_stapel_angelegt", { mit_fach: Boolean(fachId) });
            router.push(`/karteikarten/${neu.id}`);
          }}
        />
      )}
      {dialog?.modus === "bearbeiten" && (
        <StapelDialog
          titel="Stapel bearbeiten"
          knopf="Speichern"
          faecher={faecher}
          startName={dialog.stapel.name}
          startFachId={dialog.stapel.fach_id}
          onSchliessen={() => setDialog(null)}
          onSpeichern={async (name, fachId) => {
            await stapelBearbeiten(dialog.stapel.id, name, fachId);
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
