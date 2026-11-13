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
import { intervallText, reife, REIFE_TEXT, type Reife } from "@/lib/karteikarten/wiederholung";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";

const TAG_MS = 86_400_000;

/** "fällig", "gleich", "morgen", "in 5 T." – relativ zu heute (Berlin). */
function wannWieder(naechste: string, jetzt: Date, heute0: Date): string {
  const zeit = new Date(naechste).getTime();
  if (zeit <= jetzt.getTime()) return "fällig";
  const tage = Math.round((zeit - heute0.getTime()) / TAG_MS);
  if (tage <= 0) return "gleich";
  if (tage === 1) return "morgen";
  return `in ${intervallText(tage)}`;
}

export function StapelAnsicht({ stapel, karten: start, faecher }: { stapel: Stapel; karten: Karte[]; faecher: FachOption[] }) {
  const router = useRouter();
  const [karten, setKarten] = useState(start);
  const [neuOffen, setNeuOffen] = useState(false);
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [stapelDialog, setStapelDialog] = useState(false);

  const fach = faecher.find((f) => f.id === stapel.fach_id) ?? null;
  const jetztDatum = new Date();
  const jetzt = jetztDatum.toISOString();
  const faellig = karten.filter((k) => k.naechste_abfrage <= jetzt).length;
  const heute = berlinDatum(jetztDatum);
  const heute0 = berlinMitternacht(heute, 0);
  const bisMorgen = berlinMitternacht(heute, 2).toISOString();
  const bisWoche = berlinMitternacht(heute, 8).toISOString();
  const reifeZahl = karten.reduce<Record<Reife, number>>(
    (z, k) => ({ ...z, [reife(k)]: z[reife(k)] + 1 }),
    { neu: 0, lernen: 0, jung: 0, sicher: 0 },
  );
  const morgen = karten.filter((k) => k.naechste_abfrage > jetzt && k.naechste_abfrage < bisMorgen).length;
  const woche = karten.filter((k) => k.naechste_abfrage < bisWoche).length;

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

      {karten.length > 0 && (
        <section className="card kk-lernstand" aria-label="Lernstand">
          <ul className="kk-reife-zahlen">
            {(Object.keys(REIFE_TEXT) as Reife[]).map((r) => (
              <li key={r} className={`kk-reife-${r}`}>
                <strong className="mono">{reifeZahl[r]}</strong>
                <span>{REIFE_TEXT[r]}</span>
              </li>
            ))}
          </ul>
          <div className="kk-reife-balken" aria-hidden>
            {(Object.keys(REIFE_TEXT) as Reife[]).map((r) =>
              reifeZahl[r] > 0 ? <span key={r} className={`kk-reife-${r}`} style={{ flexGrow: reifeZahl[r] }} /> : null,
            )}
          </div>
          <p className="muted kk-vorschau-zeile">
            Fällig: <strong>{faellig}</strong> jetzt · <strong>{morgen}</strong> morgen · <strong>{woche}</strong> in den nächsten 7 Tagen
          </p>
        </section>
      )}

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
                    <span
                      className={`tag kk-reife-tag kk-reife-${reife(k)}`}
                      title={`${REIFE_TEXT[reife(k)]} · Intervall ${k.intervall_tage} Tage · ${k.wiederholungen}× in Folge gewusst · ${k.fehler}× vergessen`}
                    >
                      {REIFE_TEXT[reife(k)]} · {wannWieder(k.naechste_abfrage, jetztDatum, heute0)}
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
