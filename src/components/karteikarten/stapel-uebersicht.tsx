"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { stapelAnlegen, stapelBearbeiten, stapelLoeschen, type Stapel } from "@/app/(hubs)/karteikarten/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { StapelDialog } from "@/components/karteikarten/stapel-dialog";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

export type StapelKachel = Stapel & { anzahl: number; faellig: number };

export function StapelUebersicht({ stapel, faecher }: { stapel: StapelKachel[]; faecher: FachOption[] }) {
  const router = useRouter();
  const fachFilter = useSearchParams().get("fachId");
  const [dialog, setDialog] = useState<{ modus: "neu" } | { modus: "bearbeiten"; stapel: StapelKachel } | null>(null);

  const sichtbar = stapel.filter((s) => !fachFilter || s.fach_id === fachFilter);
  const fachVon = (id: string | null) => faecher.find((f) => f.id === id) ?? null;

  async function loeschen(s: StapelKachel) {
    const hinweis = s.anzahl > 0 ? ` mit ${s.anzahl} ${s.anzahl === 1 ? "Karte" : "Karten"}` : "";
    if (!window.confirm(`Stapel „${s.name}“${hinweis} wirklich löschen?`)) return;
    try {
      await stapelLoeschen(s.id);
      track("kk_stapel_geloescht", { karten: s.anzahl });
      router.refresh();
    } catch (err) {
      fehlerMelden(err, { ort: "kk_stapel_loeschen" });
      window.alert("Löschen hat nicht geklappt. Bitte versuch es nochmal.");
    }
  }

  const neuKnopf = (
    <button type="button" className="btnp" onClick={() => setDialog({ modus: "neu" })}>
      + Neuer Stapel
    </button>
  );

  return (
    <>
      <HubKopf titel="Karteikarten" untertitel="Lernen mit Wiederholung – fällige Karten kommen automatisch wieder." aktionen={neuKnopf} />
      <FachFilterChips faecher={faecher} />

      {stapel.length === 0 ? (
        <LeererZustand
          icon="🗂️"
          text="Noch keine Karteikarten. Leg deinen ersten Stapel an, z. B. „Mathe 1 – Definitionen“."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={() => setDialog({ modus: "neu" })}>
              + Ersten Stapel anlegen
            </button>
          }
        />
      ) : sichtbar.length === 0 ? (
        <p className="empty-state">Für dieses Fach gibt es noch keinen Stapel.</p>
      ) : (
        <div className="kk-raster">
          {sichtbar.map((s) => {
            const fach = fachVon(s.fach_id);
            return (
              <article key={s.id} className="card kk-kachel">
                <div className="kk-kachel-kopf">
                  <Link href={`/karteikarten/${s.id}`} className="kk-kachel-name">
                    {s.name}
                  </Link>
                  <DreiPunkteMenue
                    punkte={[
                      { label: "Bearbeiten", onClick: () => setDialog({ modus: "bearbeiten", stapel: s }) },
                      { label: "Löschen", onClick: () => void loeschen(s), gefahr: true },
                    ]}
                  />
                </div>
                <div className="kk-kachel-fach muted">
                  {fach ? (
                    <>
                      <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                    </>
                  ) : (
                    "Ohne Fach"
                  )}
                </div>
                <div className="kk-kachel-zahlen">
                  <span>
                    {s.anzahl} {s.anzahl === 1 ? "Karte" : "Karten"}
                  </span>
                  <span className={s.faellig > 0 ? "tag tag-accent" : "tag"}>{s.faellig} heute fällig</span>
                </div>
                <div className="kk-kachel-knoepfe">
                  <Link href={`/karteikarten/${s.id}`} className="btng">
                    Öffnen
                  </Link>
                  {s.anzahl > 0 && (
                    <Link href={`/karteikarten/${s.id}/lernen`} className="btnp">
                      Lernen
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

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
