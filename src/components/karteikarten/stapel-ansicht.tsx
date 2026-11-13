"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  karteAnlegen,
  karteBearbeiten,
  karteLoeschen,
  stapelBearbeiten,
  stapelLoeschen,
  type Karte,
  type Stapel,
} from "@/app/(hubs)/karteikarten/actions";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { markdownAlsText } from "@/components/hubs/markdown-editor";
import { KartenFormular } from "@/components/karteikarten/karten-formular";
import { StapelDialog } from "@/components/karteikarten/stapel-dialog";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

export function StapelAnsicht({ stapel, karten: start, faecher }: { stapel: Stapel; karten: Karte[]; faecher: FachOption[] }) {
  const router = useRouter();
  const [karten, setKarten] = useState(start);
  const [neuOffen, setNeuOffen] = useState(false);
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [stapelDialog, setStapelDialog] = useState(false);

  const fach = faecher.find((f) => f.id === stapel.fach_id) ?? null;
  const jetzt = new Date().toISOString();
  const faellig = karten.filter((k) => k.naechste_abfrage <= jetzt).length;

  async function stapelEntfernen() {
    if (!window.confirm(`Stapel „${stapel.name}“ mit allen Karten wirklich löschen?`)) return;
    try {
      await stapelLoeschen(stapel.id);
      track("kk_stapel_geloescht", { karten: karten.length });
      router.push("/karteikarten");
    } catch (err) {
      fehlerMelden(err, { ort: "kk_stapel_loeschen" });
      window.alert("Löschen hat nicht geklappt. Bitte versuch es nochmal.");
    }
  }

  async function karteEntfernen(k: Karte) {
    if (!window.confirm("Karte wirklich löschen?")) return;
    setKarten((liste) => liste.filter((x) => x.id !== k.id));
    try {
      await karteLoeschen(k.id);
      track("kk_karte_geloescht");
    } catch (err) {
      setKarten((liste) => [...liste, k].sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am)));
      fehlerMelden(err, { ort: "kk_karte_loeschen" });
      window.alert("Löschen hat nicht geklappt. Bitte versuch es nochmal.");
    }
  }

  const neuKnopf = (
    <button
      type="button"
      className="btnp"
      onClick={() => {
        setBearbeitenId(null);
        setNeuOffen(true);
      }}
    >
      + Karte
    </button>
  );

  return (
    <>
      <Link href="/karteikarten" className="hub-zurueck-link">
        ← Alle Stapel
      </Link>
      <HubKopf
        titel={stapel.name}
        untertitel={`${fach ? fach.name : "Ohne Fach"} · ${karten.length} ${karten.length === 1 ? "Karte" : "Karten"} · ${faellig} heute fällig`}
        aktionen={
          <>
            {karten.length > 0 && (
              <Link href={`/karteikarten/${stapel.id}/lernen`} className="btng">
                Lernen
              </Link>
            )}
            {neuKnopf}
            <DreiPunkteMenue
              punkte={[
                { label: "Stapel bearbeiten", onClick: () => setStapelDialog(true) },
                { label: "Stapel löschen", onClick: () => void stapelEntfernen(), gefahr: true },
              ]}
            />
          </>
        }
      />

      {neuOffen && (
        <div className="card">
          <h2 className="ct" style={{ marginBottom: 12 }}>
            Neue Karte
          </h2>
          <KartenFormular
            mitNaechste
            onAbbrechen={() => setNeuOffen(false)}
            onSpeichern={async (v, r, naechste) => {
              const karte = await karteAnlegen(stapel.id, v, r);
              setKarten((liste) => [...liste, karte]);
              track("kk_karte_angelegt", { weiter: naechste });
              if (!naechste) setNeuOffen(false);
            }}
          />
        </div>
      )}

      {karten.length === 0 && !neuOffen ? (
        <LeererZustand
          icon="🃏"
          text="Dieser Stapel ist noch leer. Leg die erste Karte an."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={() => setNeuOffen(true)}>
              + Erste Karte anlegen
            </button>
          }
        />
      ) : (
        karten.length > 0 && (
          <section className="card">
            <ul className="kk-kartenliste">
              {karten.map((k) =>
                bearbeitenId === k.id ? (
                  <li key={k.id} className="kk-karte-bearbeiten">
                    <KartenFormular
                      startVorderseite={k.vorderseite}
                      startRueckseite={k.rueckseite}
                      mitNaechste={false}
                      onAbbrechen={() => setBearbeitenId(null)}
                      onSpeichern={async (v, r) => {
                        const neu = await karteBearbeiten(k.id, v, r);
                        setKarten((liste) => liste.map((x) => (x.id === k.id ? neu : x)));
                        setBearbeitenId(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={k.id} className="kk-karte-zeile">
                    <button
                      type="button"
                      className="kk-karte-vorschau"
                      onClick={() => {
                        setNeuOffen(false);
                        setBearbeitenId(k.id);
                      }}
                      title="Bearbeiten"
                    >
                      <span className="kk-karte-vorne">{markdownAlsText(k.vorderseite) || "—"}</span>
                      <span className="kk-karte-hinten muted">{markdownAlsText(k.rueckseite)}</span>
                    </button>
                    <span className="tag" title={`Box ${k.box} von 5`}>
                      Box {k.box}
                    </span>
                    <DreiPunkteMenue
                      punkte={[
                        { label: "Bearbeiten", onClick: () => setBearbeitenId(k.id) },
                        { label: "Löschen", onClick: () => void karteEntfernen(k), gefahr: true },
                      ]}
                    />
                  </li>
                ),
              )}
            </ul>
          </section>
        )
      )}

      {stapelDialog && (
        <StapelDialog
          titel="Stapel bearbeiten"
          knopf="Speichern"
          faecher={faecher}
          startName={stapel.name}
          startFachId={stapel.fach_id}
          onSchliessen={() => setStapelDialog(false)}
          onSpeichern={async (name, fachId) => {
            await stapelBearbeiten(stapel.id, name, fachId);
            setStapelDialog(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
