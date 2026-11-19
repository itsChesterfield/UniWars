"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  gedaechtnisAllesLoeschen,
  gedaechtnisBearbeiten,
  gedaechtnisHinzufuegen,
  gedaechtnisLernenSetzen,
  gedaechtnisLoeschen,
  gedaechtnisStatusSetzen,
  kennenlernenZuruecksetzen,
} from "@/app/(hubs)/einstellungen/gedaechtnis-actions";
import {
  ampel,
  BEREICH_INFO,
  BEREICHE,
  QUELLE_NAME,
  type Bereich,
  type Eintrag,
} from "@/lib/ki/gedaechtnis";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { fehlerMelden, track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

type Thema = {
  id: string;
  thema: string;
  beherrschung: number;
  versuche: number;
  fehlerbild: string | null;
  fach: string | null;
  farbe: string | null;
};

const AMPEL_TEXT = {
  sicher: "sitzt",
  wackelt: "wackelt",
  fehlt: "fehlt noch",
} as const;

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  });
}

export function GedaechtnisVerwaltung({
  startEintraege,
  lernenAn,
  kennenlernen,
  rueckblickIds,
  themen,
  rhythmus,
}: {
  startEintraege: Eintrag[];
  lernenAn: boolean;
  kennenlernen: "neu" | "auffrischen" | "fertig";
  rueckblickIds: string[];
  themen: Thema[];
  rhythmus: string | null;
}) {
  const router = useRouter();
  const [eintraege, setEintraege] = useState(startEintraege);
  const [an, setAn] = useState(lernenAn);
  const [bearbeiten, setBearbeiten] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [neu, setNeu] = useState<{ bereich: Bereich; text: string }>({
    bereich: "lernstil",
    text: "",
  });
  const [fehler, setFehler] = useState<string | null>(null);

  const vorschlaege = eintraege.filter((e) => e.status === "vorschlag");
  const aktiv = eintraege.filter((e) => e.status === "aktiv");
  const neuGelernt = aktiv.filter((e) => rueckblickIds.includes(e.id));
  const nachFach = useMemo(() => {
    const m = new Map<string, Thema[]>();
    for (const t of themen) {
      const k = t.fach ?? "Ohne Fach";
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()];
  }, [themen]);

  const entfernen = (id: string) =>
    setEintraege((l) => l.filter((e) => e.id !== id));

  function exportieren() {
    const daten = {
      exportiert_am: new Date().toISOString(),
      gedaechtnis: eintraege,
      wissensstand: themen,
      rhythmus,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "universe-studio-gedaechtnis.json";
    a.click();
    URL.revokeObjectURL(url);
    track("gedaechtnis_export");
  }

  return (
    <div className="gd-seite">
      <section className="card gd-abschnitt">
        <div className="gd-zeile">
          <span>
            <strong>Studio lernt über mich</strong>
            <small className="faint gd-klein">
              Aus Gesprächen, Rückmeldungen, Quiz und Karteikarten.
              Ausgeschaltet nutzt Studio weiter, was es weiß, lernt aber nichts
              Neues.
            </small>
          </span>
          <button
            type="button"
            className={`btng gd-schalter ${an ? "an" : ""}`}
            aria-pressed={an}
            onClick={() => {
              const neuAn = !an;
              setAn(neuAn);
              void gedaechtnisLernenSetzen(neuAn).catch(() => undefined);
              track("gedaechtnis_lernen", { an: neuAn });
            }}
          >
            {an ? "An" : "Aus"}
          </button>
        </div>
        <div className="gd-knoepfe">
          <button
            type="button"
            className="btng"
            onClick={() =>
              void kennenlernenZuruecksetzen()
                .catch(() => undefined)
                .then(() => {
                  studioOeffnen();
                  track("kennenlernen_neu_gestartet");
                })
            }
          >
            {kennenlernen === "neu"
              ? "Kennenlernen starten"
              : "Kennenlernen wiederholen"}
          </button>
          <button type="button" className="btng" onClick={exportieren}>
            ⬇ Exportieren
          </button>
          <button
            type="button"
            className="btng gd-gefahr"
            onClick={() => {
              if (
                !window.confirm(
                  "Wirklich alles löschen, was Studio über dich weiß (Gedächtnis und Wissensstand)?",
                )
              )
                return;
              void gedaechtnisAllesLoeschen()
                .catch(() => ({ ok: false }))
                .then((r) => {
                  if (!r.ok)
                    return window.alert(
                      "Das hat nicht geklappt. Bitte versuch es noch einmal.",
                    );
                  setEintraege([]);
                  router.refresh();
                  track("gedaechtnis_alles_geloescht");
                });
            }}
          >
            Alles löschen
          </button>
        </div>
      </section>

      {neuGelernt.length > 0 && (
        <section className="card gd-abschnitt gd-rueckblick">
          <h2 className="gd-titel">In den letzten 30 Tagen gelernt</h2>
          <ul className="gd-liste-kurz">
            {neuGelernt.map((e) => (
              <li key={e.id}>
                <Icon name={BEREICH_INFO[e.bereich].icon} groesse={14} /> {e.inhalt}
              </li>
            ))}
          </ul>
        </section>
      )}

      {vorschlaege.length > 0 && (
        <section className="card gd-abschnitt">
          <h2 className="gd-titel">Soll ich mir das merken?</h2>
          <ul className="gd-liste">
            {vorschlaege.map((e) => (
              <li key={e.id} className="gd-eintrag">
                <span className="gd-inhalt">
                  <Icon name={BEREICH_INFO[e.bereich].icon} groesse={14} /> {e.inhalt}
                </span>
                <span className="gd-aktionen">
                  <button
                    type="button"
                    className="btnp"
                    onClick={() => {
                      setEintraege((l) =>
                        l.map((x) =>
                          x.id === e.id ? { ...x, status: "aktiv" } : x,
                        ),
                      );
                      void gedaechtnisStatusSetzen(e.id, "aktiv").catch(
                        () => undefined,
                      );
                    }}
                  >
                    Ja
                  </button>
                  <button
                    type="button"
                    className="btng"
                    onClick={() => {
                      entfernen(e.id);
                      void gedaechtnisStatusSetzen(e.id, "verworfen").catch(
                        () => undefined,
                      );
                    }}
                  >
                    Nein
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card gd-abschnitt">
        <h2 className="gd-titel">Was Studio über dich weiß ({aktiv.length})</h2>
        {aktiv.length === 0 && (
          <p className="faint">
            Noch nichts. Erzähl Studio von dir (Strg+J) oder starte das
            Kennenlernen.
          </p>
        )}
        {BEREICHE.map((b) => {
          const liste = aktiv.filter((e) => e.bereich === b);
          if (!liste.length) return null;
          return (
            <div key={b} className="gd-bereich">
              <h3>
                <Icon name={BEREICH_INFO[b].icon} groesse={14} /> {BEREICH_INFO[b].name}
              </h3>
              <ul className="gd-liste">
                {liste.map((e) => (
                  <li key={e.id} className="gd-eintrag">
                    {bearbeiten?.id === e.id ? (
                      <form
                        className="gd-bearbeiten"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          const text = bearbeiten.text.trim();
                          if (!text) return;
                          setEintraege((l) =>
                            l.map((x) =>
                              x.id === e.id
                                ? {
                                    ...x,
                                    inhalt: text,
                                    quelle: "ausdruecklich",
                                  }
                                : x,
                            ),
                          );
                          setBearbeiten(null);
                          void gedaechtnisBearbeiten(e.id, text).catch(
                            () => undefined,
                          );
                        }}
                      >
                        <input
                          className="field"
                          autoFocus
                          maxLength={300}
                          value={bearbeiten.text}
                          onChange={(ev) =>
                            setBearbeiten({ id: e.id, text: ev.target.value })
                          }
                        />
                        <button type="submit" className="btnp">
                          Speichern
                        </button>
                        <button
                          type="button"
                          className="btng"
                          onClick={() => setBearbeiten(null)}
                        >
                          Abbrechen
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="gd-inhalt">
                          {e.inhalt}
                          <small className="faint">
                            {QUELLE_NAME[e.quelle]}, {datum(e.erstellt_am)}
                            {e.fest ? ", dauerhaft" : ""}
                          </small>
                        </span>
                        <span className="gd-aktionen">
                          <button
                            type="button"
                            className="icon-knopf"
                            title="Bearbeiten"
                            aria-label="Bearbeiten"
                            onClick={() =>
                              setBearbeiten({ id: e.id, text: e.inhalt })
                            }
                          >
                            <Icon name="stift" groesse={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-knopf"
                            title="Löschen"
                            aria-label="Löschen"
                            onClick={() => {
                              entfernen(e.id);
                              void gedaechtnisLoeschen(e.id).catch(
                                () => undefined,
                              );
                              track("gedaechtnis_geloescht", {
                                bereich: e.bereich,
                              });
                            }}
                          >
                            <Icon name="loeschen" groesse={16} />
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <form
          className="gd-neu"
          onSubmit={(ev) => {
            ev.preventDefault();
            setFehler(null);
            gedaechtnisHinzufuegen(neu.bereich, neu.text)
              .then((a) => {
                if (!a.ok) return setFehler(a.fehler);
                setEintraege((l) => [
                  {
                    id: a.daten.id,
                    bereich: neu.bereich,
                    inhalt: neu.text.trim(),
                    quelle: "ausdruecklich",
                    sicherheit: 1,
                    status: "aktiv",
                    fest: false,
                    zuletzt_genutzt: null,
                    erstellt_am: new Date().toISOString(),
                  },
                  ...l.filter((x) => x.id !== a.daten.id),
                ]);
                setNeu({ ...neu, text: "" });
                track("gedaechtnis_hinzugefuegt", { bereich: neu.bereich });
              })
              .catch((err) => fehlerMelden(err, { ort: "gedaechtnis_neu" }));
          }}
        >
          <select
            className="field"
            value={neu.bereich}
            aria-label="Bereich"
            onChange={(e) =>
              setNeu({ ...neu, bereich: e.target.value as Bereich })
            }
          >
            {BEREICHE.map((b) => (
              <option key={b} value={b}>
                {BEREICH_INFO[b].name}
              </option>
            ))}
          </select>
          <input
            className="field"
            maxLength={300}
            placeholder="Selbst etwas hinzufügen, z. B. „lerne am besten morgens“"
            value={neu.text}
            onChange={(e) => setNeu({ ...neu, text: e.target.value })}
          />
          <button type="submit" className="btnp" disabled={!neu.text.trim()}>
            Hinzufügen
          </button>
        </form>
        {fehler && <p className="auth-error">{fehler}</p>}
      </section>

      <section className="card gd-abschnitt">
        <h2 className="gd-titel">Wissensstand</h2>
        {rhythmus && <p className="faint">Rhythmus: {rhythmus}</p>}
        {nachFach.length === 0 ? (
          <p className="faint">
            Entsteht aus Quiz und Karteikarten, je mehr du übst, desto genauer.
          </p>
        ) : (
          nachFach.map(([fach, liste]) => (
            <div key={fach} className="gd-bereich">
              <h3>{fach}</h3>
              <ul className="gd-themen">
                {liste.map((t) => {
                  const a = ampel(t.beherrschung);
                  return (
                    <li
                      key={t.id}
                      className={`gd-thema ${a}`}
                      title={t.fehlerbild ?? undefined}
                    >
                      <span className="gd-ampel" aria-hidden />
                      <span className="gd-thema-name">{t.thema}</span>
                      <span className="faint gd-thema-info">
                        {AMPEL_TEXT[a]}, {Math.round(t.beherrschung * 100)} %
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
