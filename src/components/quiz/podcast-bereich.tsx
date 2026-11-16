"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { podcastErstellen, podcastLoeschen } from "@/app/(hubs)/transkription/podcast-actions";
import { QuellenWahl, type Fach, type QuellOption, type QuellWahl } from "@/components/quiz/quellen-wahl";
import type { PodcastLaenge } from "@/lib/ki/quiz";
import { fehlerMelden, track } from "@/lib/analytics";

export type PodcastKachel = { id: string; titel: string; fach_id: string | null; segmente: number; erstellt_am: string };

/** Transkription: Lern-Podcasts – das Material als Gespräch zweier Stimmen zum Anhören */
export function PodcastBereich({ podcasts, faecher, optionen, kiVerfuegbar }: { podcasts: PodcastKachel[]; faecher: Fach[]; optionen: QuellOption[]; kiVerfuegbar: boolean }) {
  const [neu, setNeu] = useState(false);
  const router = useRouter();
  return (
    <section className="qz-bereich" aria-labelledby="pc-titel">
      <div className="qz-kopf">
        <div>
          <h2 id="pc-titel" className="qz-titel">🎧 Lern-Podcasts</h2>
          <p className="muted qz-untertitel">Dein Skript als Gespräch zum Anhören – für unterwegs, beim Sport oder vor dem Einschlafen.</p>
        </div>
        {kiVerfuegbar && (
          <button type="button" className="btnp" onClick={() => setNeu(true)}>
            + Neuer Podcast
          </button>
        )}
      </div>
      {podcasts.length === 0 ? (
        <p className="empty-state">Noch kein Podcast. Erstell einen aus einem Fach oder einzelnen PDFs und Notizen.</p>
      ) : (
        <div className="kk-raster">
          {podcasts.map((p) => {
            const fach = faecher.find((f) => f.id === p.fach_id);
            return (
              <article key={p.id} className="card kk-kachel">
                <div className="kk-kachel-kopf">
                  <Link href={`/transkription/podcast/${p.id}`} className="kk-kachel-name">
                    🎧 {p.titel}
                  </Link>
                  <button
                    type="button"
                    className="icon-knopf"
                    aria-label="Podcast löschen"
                    title="Löschen"
                    onClick={() => {
                      if (!window.confirm(`Podcast „${p.titel}“ löschen?`)) return;
                      void podcastLoeschen(p.id).then(() => router.refresh());
                    }}
                  >
                    🗑
                  </button>
                </div>
                {fach && (
                  <div className="kk-kachel-fach muted">
                    <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                  </div>
                )}
                <div className="qz-kachel-zahlen muted">
                  <span>{p.segmente} Abschnitte</span>
                  <span>{new Date(p.erstellt_am).toLocaleDateString("de-DE")}</span>
                </div>
                <div className="kk-kachel-knoepfe">
                  <Link href={`/transkription/podcast/${p.id}`} className="btnp">
                    ▶ Anhören
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {neu && <PodcastNeuDialog faecher={faecher} optionen={optionen} onSchliessen={() => setNeu(false)} />}
    </section>
  );
}

function PodcastNeuDialog({ faecher, optionen, onSchliessen }: { faecher: Fach[]; optionen: QuellOption[]; onSchliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [wahl, setWahl] = useState<QuellWahl>({ fachId: null, quellen: [] });
  const [laenge, setLaenge] = useState<PodcastLaenge>("normal");
  const [fokus, setFokus] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function erstellen(e: React.FormEvent) {
    e.preventDefault();
    if (!wahl.quellen.length && !wahl.fachId) return setFehler("Wähle ein Fach oder mindestens eine PDF/Notiz.");
    setFehler(null);
    setLaeuft(true);
    try {
      const a = await podcastErstellen({ quellen: wahl.quellen, fachId: wahl.fachId, laenge, fokus });
      if (!a.ok) {
        setFehler(a.fehler);
        setLaeuft(false);
        return;
      }
      track("podcast_erstellt", { laenge });
      router.push(`/transkription/podcast/${a.daten.id}`);
    } catch (err) {
      fehlerMelden(err, { ort: "podcast_erstellen" });
      setFehler("Das hat nicht geklappt. Bitte versuch es noch einmal.");
      setLaeuft(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="quick-add-modal qz-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!laeuft) onSchliessen();
      }}
    >
      <form onSubmit={erstellen} className="hub-formular">
        <h3>Neuer Lern-Podcast</h3>
        <QuellenWahl faecher={faecher} optionen={optionen} wert={wahl} onAendern={setWahl} />
        <div className="qz-feld">
          <span>Länge</span>
          <span className="segwrap" role="radiogroup" aria-label="Länge">
            {(
              [
                ["kurz", "~3 Min"],
                ["normal", "~6 Min"],
                ["lang", "~10 Min"],
              ] as [PodcastLaenge, string][]
            ).map(([l, name]) => (
              <button key={l} type="button" role="radio" aria-checked={laenge === l} className={`seg ${laenge === l ? "on" : ""}`} onClick={() => setLaenge(l)}>
                {name}
              </button>
            ))}
          </span>
        </div>
        <label>
          <span>Schwerpunkt (optional)</span>
          <input className="field" value={fokus} maxLength={300} placeholder="z. B. „nur Kapitel 3“ oder „Fokus auf Formeln“" onChange={(e) => setFokus(e.target.value)} />
        </label>
        {fehler && <p className="auth-error">{fehler}</p>}
        {laeuft && <p className="faint">Das Skript wird geschrieben – das dauert etwa eine Minute …</p>}
        <div className="hub-formular-knoepfe">
          <button type="button" className="btng" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </button>
          <button type="submit" className="btnp" disabled={laeuft}>
            {laeuft ? "Erstelle …" : "Podcast erstellen"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
