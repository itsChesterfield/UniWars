"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { quelleLoeschen, quelleSpeichern, type Quelle, type QuelleEingabe } from "@/app/(hubs)/literaturverwaltung/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { inDenPapierkorb } from "@/components/rueckfrage";
import { meldung } from "@/components/meldung";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import {
  erstautorKurz,
  literaturverzeichnis,
  verzeichnisEintrag,
  zitatImText,
  type QuelleDaten,
  type QuellenTyp,
} from "@/lib/literatur/apa";
import type { FachOption } from "@/lib/fach-option";
import { berlinDatum } from "@/lib/zeit";
import { fehlerMelden, track } from "@/lib/analytics";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { kopfListe } from "@/lib/bereichskopf";

const TYP_NAME: Record<QuellenTyp, string> = { BUCH: "Buch", ARTIKEL: "Artikel", WEBSEITE: "Webseite" };
type Spalte = "autor" | "jahr" | "titel" | "typ" | "fach";

function daten(q: Quelle): QuelleDaten {
  return { ...q, typ: q.typ as QuellenTyp };
}

async function kopieren(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Kopieren selbst sieht man nicht, deshalb eine kurze Rückmeldung */
function kopierMeldung(ok: boolean) {
  meldung(ok ? "Kopiert" : "Kopieren hat nicht geklappt.", ok ? "hinweis" : "fehler");
}

export function Literaturverwaltung({
  initialQuellen,
  faecher,
  pdfs,
  kiVerfuegbar = false,
}: {
  initialQuellen: Quelle[];
  faecher: FachOption[];
  pdfs: { id: string; name: string }[];
  kiVerfuegbar?: boolean;
}) {
  const suchparameter = useSearchParams();
  const fachFilter = suchparameter.get("fachId");
  const quelleId = suchparameter.get("id");
  const [quellen, setQuellen] = useState(initialQuellen);
  const [suche, setSuche] = useState("");
  const [sortierung, setSortierung] = useState<{ spalte: Spalte; ab: boolean }>({ spalte: "autor", ab: false });
  const [formular, setFormular] = useState<{ quelle: Quelle | null } | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [verzeichnis, setVerzeichnis] = useState<string[] | null>(null);

  const fachName = (id: string | null) => faecher.find((f) => f.id === id)?.name ?? "";

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase("de-DE");
    const liste = quellen.filter(
      (x) =>
        (!quelleId || x.id === quelleId) &&
        (!fachFilter || x.fach_id === fachFilter) &&
        (!q || [x.autoren, x.titel, String(x.jahr), x.verlag ?? "", x.notiz ?? ""].some((f) => f.toLocaleLowerCase("de-DE").includes(q))),
    );
    const faktor = sortierung.ab ? -1 : 1;
    const wert = (x: Quelle): string | number => {
      switch (sortierung.spalte) {
        case "jahr":
          return x.jahr;
        case "titel":
          return x.titel;
        case "typ":
          return TYP_NAME[x.typ as QuellenTyp];
        case "fach":
          return faecher.find((f) => f.id === x.fach_id)?.name ?? "";
        default:
          return x.autoren;
      }
    };
    return liste.sort((a, b) => {
      const wa = wert(a);
      const wb = wert(b);
      return faktor * (typeof wa === "number" && typeof wb === "number" ? wa - wb : String(wa).localeCompare(String(wb), "de"));
    });
  }, [quellen, suche, fachFilter, quelleId, sortierung, faecher]);

  function sortieren(spalte: Spalte) {
    setSortierung((s) => (s.spalte === spalte ? { spalte, ab: !s.ab } : { spalte, ab: spalte === "jahr" }));
  }
  const sortRichtung = (spalte: Spalte) => (sortierung.spalte === spalte ? (sortierung.ab ? "descending" : "ascending") : undefined);

  async function zitieren(q: Quelle, art: "text" | "verzeichnis") {
    const text = art === "text" ? zitatImText(daten(q)) : verzeichnisEintrag(daten(q));
    kopierMeldung(await kopieren(text));
    track("quelle_zitiert", { art });
  }

  async function loeschen(q: Quelle, bestaetigt = false) {
    if (!bestaetigt && !(await inDenPapierkorb(`Die Quelle „${q.titel}“`))) return;
    setQuellen((l) => l.filter((x) => x.id !== q.id));
    setAuswahl((a) => {
      const neu = new Set(a);
      neu.delete(q.id);
      return neu;
    });
    try {
      await quelleLoeschen(q.id);
      track("quelle_geloescht");
    } catch (err) {
      setQuellen((l) => [q, ...l]);
      meldung("Löschen hat nicht geklappt.", "fehler", () => loeschen(q, true));
      fehlerMelden(err, { ort: "quelle_loeschen" });
    }
  }

  function umschalten(id: string) {
    setAuswahl((a) => {
      const neu = new Set(a);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  const ausgewaehlt = quellen.filter((q) => auswahl.has(q.id));
  const alleSichtbarGewaehlt = sichtbar.length > 0 && sichtbar.every((q) => auswahl.has(q.id));

  const neuKnopf = (klasse: string, text: string) => (
    <button type="button" className={`knopf ${klasse}`} onClick={() => setFormular({ quelle: null })}>
      <Icon name="plus" groesse={16} />
      {text}
    </button>
  );

  return (
    <>
      <Bereichskopf
        titel="Literatur"
        untertitel={quellen.length ? undefined : "Quellen sammeln und nach APA zitieren."}
        {...(quellen.length ? { ...kopfListe(quellen.map((q) => ({ titel: q.titel, geaendert: q.erstellt_am })), "Quelle ohne Titel", ["Quelle", "Quellen"]), lage: null } : {})}
        aktionen={quellen.length > 0 ? neuKnopf("haupt", "Quelle") : undefined}
      />
      {quelleId ? <Link href="/literaturverwaltung" className="knopf leise klein">Alle Quellen</Link> : <FachFilterChips faecher={faecher} />}

      {formular && (
        <QuellenFormular
          quelle={formular.quelle}
          faecher={faecher}
          pdfs={pdfs}
          kiVerfuegbar={kiVerfuegbar}
          startFachId={fachFilter}
          onAbbrechen={() => setFormular(null)}
          onGespeichert={(q, neu) => {
            setQuellen((l) => (neu ? [q, ...l] : l.map((x) => (x.id === q.id ? q : x))));
            setFormular(null);
            track(neu ? "quelle_angelegt" : "quelle_bearbeitet", { typ: q.typ, mit_datei: Boolean(q.datei_id) });
          }}
        />
      )}

      {quellen.length === 0 ? (
        <Zustand art="leer" icon="literatur" titel="Noch keine Quellen." aktion={neuKnopf("neben klein", "Erste Quelle anlegen")}>
          Sammle hier Bücher, Artikel und Webseiten für deine Hausarbeit und zitiere sie nach APA.
        </Zustand>
      ) : (
        <>
          <div className="lit-werkzeuge">
            <input type="search" className="lit-suche" aria-label="Quellen durchsuchen" placeholder="Quellen durchsuchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            <button
              type="button"
              className="knopf neben klein"
              disabled={ausgewaehlt.length === 0}
              onClick={() => {
                setVerzeichnis(literaturverzeichnis(ausgewaehlt.map(daten)));
                track("literaturverzeichnis_erstellt", { quellen: ausgewaehlt.length });
              }}
            >
              Verzeichnis erstellen
              {ausgewaehlt.length > 0 && <span className="zahl">{ausgewaehlt.length}</span>}
            </button>
          </div>

          {verzeichnis && (
            <section className="lit-verzeichnis" aria-labelledby="lit-verzeichnis-titel">
              <div className="abschnitt-kopf">
                <h2 id="lit-verzeichnis-titel" className="abschnitt-titel">
                  Verzeichnis nach APA
                </h2>
                <div className="rechts">
                  <button
                    type="button"
                    className="knopf neben klein"
                    onClick={async () => kopierMeldung(await kopieren(verzeichnis.join("\n\n")))}
                  >
                    <Icon name="kopieren" groesse={16} />
                    Alles kopieren
                  </button>
                  <button type="button" className="knopf leise klein nur-symbol" aria-label="Verzeichnis schließen" onClick={() => setVerzeichnis(null)}>
                    <Icon name="schliessen" groesse={16} />
                  </button>
                </div>
              </div>
              <ol>
                {verzeichnis.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
            </section>
          )}

          {sichtbar.length === 0 ? (
            suche.trim() ? (
              <Zustand
                art="leer"
                icon="suchen"
                titel="Keine passenden Quellen."
                region
                ebene={3}
                aktion={
                  <button type="button" className="knopf neben klein" onClick={() => setSuche("")}>
                    Suche zurücksetzen
                  </button>
                }
              />
            ) : (
              <Zustand art="leer" icon="literatur" titel="In diesem Fach gibt es noch keine Quelle." region ebene={3} aktion={neuKnopf("neben klein", "Quelle anlegen")} />
            )
          ) : (
            <div className="dat-tabelle-wrap lit-tabelle-wrap">
              <table className="dat-tabelle lit-tabelle">
                <thead>
                  <tr>
                    <th className="lit-spalte-wahl">
                      <input
                        type="checkbox"
                        aria-label="Alle auswählen"
                        checked={alleSichtbarGewaehlt}
                        onChange={() =>
                          setAuswahl((a) => {
                            const neu = new Set(a);
                            for (const q of sichtbar) {
                              if (alleSichtbarGewaehlt) neu.delete(q.id);
                              else neu.add(q.id);
                            }
                            return neu;
                          })
                        }
                      />
                    </th>
                    {(
                      [
                        ["autor", "Autor"],
                        ["jahr", "Jahr"],
                        ["titel", "Titel"],
                        ["typ", "Typ"],
                        ["fach", "Fach"],
                      ] as [Spalte, string][]
                    ).map(([sp, label]) => (
                      <th key={sp} className={`lit-spalte-${sp}`} aria-sort={sortRichtung(sp)}>
                        <button type="button" onClick={() => sortieren(sp)}>
                          {label}
                          {sortRichtung(sp) && <Icon name={sortRichtung(sp) === "descending" ? "runter" : "hoch"} groesse={14} />}
                        </button>
                      </th>
                    ))}
                    <th>
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sichtbar.map((q) => (
                    <tr key={q.id}>
                      <td className="lit-spalte-wahl">
                        <input type="checkbox" aria-label={`${q.titel} auswählen`} checked={auswahl.has(q.id)} onChange={() => umschalten(q.id)} />
                      </td>
                      <td className="lit-spalte-autor">{erstautorKurz(q.autoren)}</td>
                      <td className="lit-spalte-jahr">{q.jahr}</td>
                      <td className="lit-spalte-titel">
                        <button type="button" className="dat-name-knopf" onClick={() => setFormular({ quelle: q })} title={q.notiz ?? undefined}>
                          {q.titel}
                        </button>
                        {q.datei_id && (
                          <Link href={`/pdf-reader/${q.datei_id}`} className="knopf leise klein lit-pdf" title="Verknüpfte PDF öffnen">
                            <Icon name="pdf" groesse={16} />
                            PDF
                          </Link>
                        )}
                      </td>
                      <td className="lit-spalte-typ">
                        <span className="lit-typ">{TYP_NAME[q.typ as QuellenTyp]}</span>
                      </td>
                      <td className="lit-spalte-fach">{fachName(q.fach_id) || "Ohne Fach"}</td>
                      <td className="dat-spalte-aktion">
                        <div className="lit-aktionen">
                          <DreiPunkteMenue
                            label={`${q.titel} zitieren`}
                            knopfText="Zitieren"
                            punkte={[
                              { label: "Im Text (APA)", onClick: () => void zitieren(q, "text") },
                              { label: "Literaturverzeichnis (APA)", onClick: () => void zitieren(q, "verzeichnis") },
                            ]}
                          />
                          <DreiPunkteMenue
                            label={`Weitere Aktionen für ${q.titel}`}
                            punkte={[
                              { label: "Bearbeiten", onClick: () => setFormular({ quelle: q }) },
                              { label: "In den Papierkorb", onClick: () => void loeschen(q), gefahr: true },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** LIT-01 / LIT-05 / LIT-06 */
function QuellenFormular({
  quelle,
  faecher,
  pdfs,
  startFachId,
  onAbbrechen,
  onGespeichert,
}: {
  quelle: Quelle | null;
  faecher: FachOption[];
  pdfs: { id: string; name: string }[];
  kiVerfuegbar: boolean;
  startFachId: string | null;
  onAbbrechen: () => void;
  onGespeichert: (q: Quelle, neu: boolean) => void;
}) {
  const [werte, setWerte] = useState<QuelleEingabe>(() => ({
    typ: (quelle?.typ as QuellenTyp) ?? "BUCH",
    autoren: quelle?.autoren ?? "",
    titel: quelle?.titel ?? "",
    jahr: quelle?.jahr ?? new Date().getFullYear(),
    verlag: quelle?.verlag ?? "",
    url: quelle?.url ?? "",
    abgerufenAm: quelle?.abgerufen_am ?? "",
    seiten: quelle?.seiten ?? "",
    fachId: quelle ? quelle.fach_id : startFachId,
    notiz: quelle?.notiz ?? "",
    dateiId: quelle?.datei_id ?? null,
  }));
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const web = werte.typ === "WEBSEITE";
  const setze = <K extends keyof QuelleEingabe>(k: K, v: QuelleEingabe[K]) => setWerte((w) => ({ ...w, [k]: v }));
  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      const gespeichert = await quelleSpeichern(quelle?.id ?? null, { ...werte, kiErzeugt: false });
      onGespeichert(gespeichert, !quelle);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const vorschau = werte.autoren.trim() && werte.titel.trim() ? verzeichnisEintrag({ ...werte, abgerufen_am: werte.abgerufenAm }) : null;

  return (
    <>
      <dialog
        ref={dialog}
        className="formular-dialog lit-dialog"
        aria-labelledby="lit-formular-titel"
        onCancel={(e) => {
          e.preventDefault();
          onAbbrechen();
        }}
      >
        <form className="crud-form" onSubmit={absenden}>
          <h3 id="lit-formular-titel">{quelle ? "Quelle bearbeiten" : "Neue Quelle"}</h3>
          <div className="crud-form-reihe lit-felder">
            <label>
              <span>Typ *</span>
              <select
                value={werte.typ}
                onChange={(e) => {
                  const typ = e.target.value as QuellenTyp;
                  setWerte((w) => ({ ...w, typ, abgerufenAm: typ === "WEBSEITE" && !w.abgerufenAm ? berlinDatum() : w.abgerufenAm }));
                }}
              >
                <option value="BUCH">Buch</option>
                <option value="ARTIKEL">Artikel</option>
                <option value="WEBSEITE">Webseite</option>
              </select>
            </label>
            <label className="lit-breit">
              <span>Autor(en) *</span>
              <input
                required
                value={werte.autoren}
                placeholder="Müller, Anna; Schmidt, Ben"
                aria-describedby="lit-autoren-hilfe"
                onChange={(e) => setze("autoren", e.target.value)}
                autoFocus
              />
              <small id="lit-autoren-hilfe" className="lit-hilfe">
                Mehrere Autoren mit Semikolon oder „&amp;“ trennen.
              </small>
            </label>
            <label className="lit-breit">
              <span>Titel *</span>
              <input required value={werte.titel} placeholder="Grundlagen der Informatik" onChange={(e) => setze("titel", e.target.value)} />
            </label>
            <label>
              <span>Jahr *</span>
              <input
                type="number"
                required
                min={1000}
                max={2200}
                value={werte.jahr}
                onChange={(e) => setze("jahr", Number(e.target.value))}
              />
            </label>
            <label>
              <span>{werte.typ === "ARTIKEL" ? "Zeitschrift" : web ? "Website-Name" : "Verlag"}</span>
              <input value={werte.verlag} placeholder={werte.typ === "ARTIKEL" ? "Informatik Spektrum, 44(2)" : "Springer"} onChange={(e) => setze("verlag", e.target.value)} />
            </label>
            <label className={web ? "lit-breit" : ""}>
              <span>URL{web ? " *" : ""}</span>
              <input type="url" required={web} value={werte.url} placeholder="https://…" onChange={(e) => setze("url", e.target.value)} />
            </label>
            <label>
              <span>Abgerufen am{web ? " *" : ""}</span>
              <input type="date" required={web} value={werte.abgerufenAm} onChange={(e) => setze("abgerufenAm", e.target.value)} />
            </label>
            <label>
              <span>Seiten</span>
              <input value={werte.seiten} placeholder="45–60" onChange={(e) => setze("seiten", e.target.value)} />
            </label>
            <label>
              <span>Fach</span>
              <select value={werte.fachId ?? ""} onChange={(e) => setze("fachId", e.target.value || null)}>
                <option value="">Ohne Fach</option>
                {faecher.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>PDF aus der Dateiablage</span>
              <select value={werte.dateiId ?? ""} onChange={(e) => setze("dateiId", e.target.value || null)}>
                <option value="">Keine</option>
                {pdfs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="lit-voll">
              <span>Notiz</span>
              <textarea rows={2} value={werte.notiz} placeholder="gutes Kapitel zu Automaten" onChange={(e) => setze("notiz", e.target.value)} />
            </label>
          </div>
          {vorschau && (
            <p className="lit-vorschau">
              <span>Vorschau</span>
              {vorschau}
            </p>
          )}
          {fehler && (
            <p className="formular-fehler" role="alert">
              {fehler}
            </p>
          )}
          <div className="crud-form-actions">
            <button type="submit" className="knopf haupt" disabled={laeuft} aria-busy={laeuft}>
              Speichern
            </button>
            <button type="button" className="knopf leise" onClick={onAbbrechen}>
              Abbrechen
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
