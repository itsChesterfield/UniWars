"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { podcastErstellen, podcastLoeschen } from "@/app/(hubs)/transkription/podcast-actions";
import { Icon } from "@/components/nav-icon";
import { Auswahl } from "@/components/quiz/quiz-bereich";
import { Zustand } from "@/components/zustand";
import { QuellenWahl, type Fach, type QuellOption, type QuellWahl } from "@/components/quiz/quellen-wahl";
import { inDenPapierkorb } from "@/components/rueckfrage";
import type { PodcastLaenge } from "@/lib/ki/quiz";
import { fehlerMelden, track } from "@/lib/analytics";

export type PodcastKachel = { id: string; titel: string; fach_id: string | null; segmente: number; erstellt_am: string };

/** Transkription: Lern-Podcasts – das Material als Gespräch zweier Stimmen zum Anhören */
export function PodcastBereich({ podcasts, faecher, optionen, kiVerfuegbar }: { podcasts: PodcastKachel[]; faecher: Fach[]; optionen: QuellOption[]; kiVerfuegbar: boolean }) {
  const [neu, setNeu] = useState(false);
  const [loeschfehler, setLoeschfehler] = useState("");
  const router = useRouter();

  // Aus der Befehlspalette (Strg+O): „…?neu=podcast“ öffnet gleich den Dialog
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("neu") !== "podcast" || !kiVerfuegbar) return;
    url.searchParams.delete("neu");
    window.history.replaceState(null, "", url.pathname + url.search);
    const id = window.setTimeout(() => setNeu(true), 0);
    return () => window.clearTimeout(id);
  }, [kiVerfuegbar]);
  const neuKnopf = kiVerfuegbar && (
    <button type="button" className="knopf neben klein" onClick={() => setNeu(true)}>
      <Icon name="plus" groesse={16} />
      Neuer Podcast
    </button>
  );

  return (
    <section className="kk-abschnitt" aria-labelledby="pc-titel">
      <div className="abschnitt-kopf">
        <h2 id="pc-titel" className="abschnitt-titel">
          Lern-Podcasts
        </h2>
        <span className="abschnitt-info">dein Material als Gespräch zweier Stimmen</span>
        {podcasts.length > 0 && <span className="rechts">{neuKnopf}</span>}
      </div>
      {loeschfehler && <p className="formular-fehler" role="alert">{loeschfehler}</p>}
      {podcasts.length === 0 ? (
        <Zustand art="leer" icon="kopfhoerer" titel="Noch kein Podcast." region ebene={3} aktion={neuKnopf}>
          Dein Skript als Gespräch zum Anhören, für unterwegs, beim Sport oder vor dem Einschlafen.
        </Zustand>
      ) : (
        <ul className="entry-list">
          {podcasts.map((p) => {
            const fach = faecher.find((f) => f.id === p.fach_id);
            return (
              <li key={p.id} className="entry-row fach-zeile">
                <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
                <div className="entry-info">
                  <Link href={`/transkription/podcast/${p.id}`} className="entry-title kk-name">
                    {p.titel}
                  </Link>
                  <span className="entry-meta">
                    {fach?.name ?? "Ohne Fach"}, {p.segmente} Abschnitte, {new Date(p.erstellt_am).toLocaleDateString("de-DE")}
                  </span>
                </div>
                <div className="entry-actions">
                  <Link href={`/transkription/podcast/${p.id}`} className="knopf neben klein">
                    <Icon name="abspielen" groesse={16} />
                    Anhören
                  </Link>
                  <button
                    type="button"
                    className="knopf gefahr klein nur-symbol"
                    aria-label={`Podcast „${p.titel}“ in den Papierkorb`}
                    title="In den Papierkorb"
                    onClick={async () => {
                      if (!(await inDenPapierkorb(`Der Podcast „${p.titel}“`))) return;
                      setLoeschfehler("");
                      const fehler = `„${p.titel}“ konnte nicht in den Papierkorb verschoben werden.`;
                      void podcastLoeschen(p.id).then((ergebnis) => {
                        if (ergebnis.ok) router.refresh();
                        else setLoeschfehler(fehler);
                      }).catch(() => setLoeschfehler(fehler));
                    }}
                  >
                    <Icon name="loeschen" groesse={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
      className="formular-dialog"
      aria-labelledby="podcast-neu-titel"
      onCancel={(e) => {
        e.preventDefault();
        if (!laeuft) onSchliessen();
      }}
    >
      <form onSubmit={erstellen} className="crud-form">
        <h3 id="podcast-neu-titel">Neuer Lern-Podcast</h3>
        <QuellenWahl faecher={faecher} optionen={optionen} wert={wahl} onAendern={setWahl} />
        <Auswahl
          name="Länge"
          werte={[
            ["kurz", "etwa 3 min"],
            ["normal", "etwa 6 min"],
            ["lang", "etwa 10 min"],
          ]}
          wert={laenge}
          onWahl={setLaenge}
        />
        <label htmlFor="podcast-fokus">Schwerpunkt (optional)</label>
        <input id="podcast-fokus" value={fokus} maxLength={300} placeholder="z. B. „nur Kapitel 3“ oder „Fokus auf Formeln“" onChange={(e) => setFokus(e.target.value)} />
        {fehler && (
          <p className="formular-fehler" role="alert">
            {fehler}
          </p>
        )}
        {laeuft && <p className="qz-hinweis">Das Skript wird geschrieben. Das dauert etwa eine Minute.</p>}
        <div className="crud-form-actions">
          <button type="submit" className="knopf haupt" aria-busy={laeuft} disabled={laeuft}>
            {laeuft ? "Skript wird geschrieben" : "Podcast erstellen"}
          </button>
          <button type="button" className="knopf leise" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  );
}
