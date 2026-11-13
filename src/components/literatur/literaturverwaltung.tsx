"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { quelleLoeschen, quelleSpeichern, type Quelle, type QuelleEingabe } from "@/app/(hubs)/literaturverwaltung/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
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

export function Literaturverwaltung({
  initialQuellen,
  faecher,
  pdfs,
}: {
  initialQuellen: Quelle[];
  faecher: FachOption[];
  pdfs: { id: string; name: string }[];
}) {
  const fachFilter = useSearchParams().get("fachId");
  const [quellen, setQuellen] = useState(initialQuellen);
  const [suche, setSuche] = useState("");
  const [sortierung, setSortierung] = useState<{ spalte: Spalte; ab: boolean }>({ spalte: "autor", ab: false });
  const [formular, setFormular] = useState<{ quelle: Quelle | null } | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [verzeichnis, setVerzeichnis] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fachName = (id: string | null) => faecher.find((f) => f.id === id)?.name ?? "";

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase("de-DE");
    const liste = quellen.filter(
      (x) =>
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
  }, [quellen, suche, fachFilter, sortierung, faecher]);

  function sortieren(spalte: Spalte) {
    setSortierung((s) => (s.spalte === spalte ? { spalte, ab: !s.ab } : { spalte, ab: spalte === "jahr" }));
  }
  const pfeil = (spalte: Spalte) => (sortierung.spalte === spalte ? (sortierung.ab ? " ↓" : " ↑") : "");

  async function zitieren(q: Quelle, art: "text" | "verzeichnis") {
    const text = art === "text" ? zitatImText(daten(q)) : verzeichnisEintrag(daten(q));
    setToast((await kopieren(text)) ? "Kopiert" : "Kopieren nicht möglich");
    track("quelle_zitiert", { art });
  }

  async function loeschen(q: Quelle) {
    if (!window.confirm(`Quelle „${q.titel}“ wirklich löschen?`)) return;
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
      setToast("Löschen hat nicht geklappt");
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

  const neuKnopf = (
    <button type="button" className="btnp" onClick={() => setFormular({ quelle: null })}>
      + Quelle
    </button>
  );

  return (
    <>
      <HubKopf titel="Literaturverwaltung" untertitel="Quellen sammeln und nach APA zitieren." aktionen={neuKnopf} />
      <FachFilterChips faecher={faecher} />

      {formular && (
        <QuellenFormular
          quelle={formular.quelle}
          faecher={faecher}
          pdfs={pdfs}
          startFachId={fachFilter}
          onAbbrechen={() => setFormular(null)}
          onGespeichert={(q, neu) => {
            setQuellen((l) => (neu ? [q, ...l] : l.map((x) => (x.id === q.id ? q : x))));
            setFormular(null);
            track(neu ? "quelle_angelegt" : "quelle_bearbeitet", { typ: q.typ, mit_datei: Boolean(q.datei_id) });
          }}
        />
      )}

      {quellen.length === 0 && !formular ? (
        <LeererZustand
          icon="📚"
          text="Noch keine Quellen. Sammle hier Bücher, Artikel und Webseiten für deine Hausarbeit."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={() => setFormular({ quelle: null })}>
              + Erste Quelle anlegen
            </button>
          }
        />
      ) : (
        quellen.length > 0 && (
          <section className="card lit-karte">
            <div className="lit-werkzeuge">
              <input
                type="search"
                className="field"
                placeholder="Quellen durchsuchen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
              <button
                type="button"
                className="btng"
                disabled={ausgewaehlt.length === 0}
                onClick={() => {
                  setVerzeichnis(literaturverzeichnis(ausgewaehlt.map(daten)));
                  track("literaturverzeichnis_erstellt", { quellen: ausgewaehlt.length });
                }}
              >
                Verzeichnis erstellen{ausgewaehlt.length ? ` (${ausgewaehlt.length})` : ""}
              </button>
            </div>

            {verzeichnis && (
              <div className="lit-verzeichnis">
                <div className="rowb">
                  <h3 className="ct">Literaturverzeichnis</h3>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btnp"
                      onClick={async () => setToast((await kopieren(verzeichnis.join("\n\n"))) ? "Kopiert" : "Kopieren nicht möglich")}
                    >
                      Alles kopieren
                    </button>
                    <button type="button" className="icon-knopf" aria-label="Verzeichnis schließen" onClick={() => setVerzeichnis(null)}>
                      ✕
                    </button>
                  </div>
                </div>
                <ol>
                  {verzeichnis.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ol>
              </div>
            )}

            {sichtbar.length === 0 ? (
              <p className="empty-state">Keine passenden Quellen.</p>
            ) : (
              <div className="dat-tabelle-wrap">
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
                      ).map(([s, label]) => (
                        <th key={s} className={`lit-spalte-${s}`}>
                          <button type="button" onClick={() => sortieren(s)}>
                            {label}
                            {pfeil(s)}
                          </button>
                        </th>
                      ))}
                      <th aria-label="Aktionen" />
                    </tr>
                  </thead>
                  <tbody>
                    {sichtbar.map((q) => (
                      <tr key={q.id}>
                        <td className="lit-spalte-wahl">
                          <input type="checkbox" aria-label={`${q.titel} auswählen`} checked={auswahl.has(q.id)} onChange={() => umschalten(q.id)} />
                        </td>
                        <td className="lit-spalte-autor">{erstautorKurz(q.autoren)}</td>
                        <td className="lit-spalte-jahr mono">{q.jahr}</td>
                        <td className="lit-spalte-titel">
                          <button type="button" className="dat-name-knopf" onClick={() => setFormular({ quelle: q })} title={q.notiz ?? undefined}>
                            {q.titel}
                          </button>
                          {q.datei_id && (
                            <Link href={`/pdf-reader/${q.datei_id}`} className="lit-pdf" title="Verknüpfte PDF öffnen">
                              📕 PDF
                            </Link>
                          )}
                        </td>
                        <td className="lit-spalte-typ">
                          <span className="tag">{TYP_NAME[q.typ as QuellenTyp]}</span>
                        </td>
                        <td className="lit-spalte-fach muted">{fachName(q.fach_id) || "–"}</td>
                        <td className="dat-spalte-aktion">
                          <div className="lit-aktionen">
                            <ZitierMenue onWahl={(art) => void zitieren(q, art)} />
                            <DreiPunkteMenue
                              punkte={[
                                { label: "Bearbeiten", onClick: () => setFormular({ quelle: q }) },
                                { label: "Löschen", onClick: () => void loeschen(q), gefahr: true },
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
          </section>
        )
      )}

      {toast && (
        <div className="lit-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

/** LIT-03 */
function ZitierMenue({ onWahl }: { onWahl: (art: "text" | "verzeichnis") => void }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);
  return (
    <div className="drei-punkte" ref={ref}>
      <button type="button" className="btng lit-zitieren" aria-haspopup="menu" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
        Zitieren
      </button>
      {offen && (
        <div className="drei-punkte-menue" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOffen(false);
              onWahl("text");
            }}
          >
            Im Text (APA)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOffen(false);
              onWahl("verzeichnis");
            }}
          >
            Literaturverzeichnis (APA)
          </button>
        </div>
      )}
    </div>
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
      const gespeichert = await quelleSpeichern(quelle?.id ?? null, werte);
      onGespeichert(gespeichert, !quelle);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  const vorschau = werte.autoren.trim() && werte.titel.trim() ? verzeichnisEintrag({ ...werte, abgerufen_am: werte.abgerufenAm }) : null;

  return (
    <form className="card hub-formular lit-formular" onSubmit={absenden}>
      <h2 className="ct">{quelle ? "Quelle bearbeiten" : "Neue Quelle"}</h2>
      <div className="lit-felder">
        <label>
          <span>Typ *</span>
          <select
            className="field"
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
            className="field"
            required
            value={werte.autoren}
            placeholder="Müller, Anna; Schmidt, Ben"
            onChange={(e) => setze("autoren", e.target.value)}
            autoFocus
          />
        </label>
        <label className="lit-breit">
          <span>Titel *</span>
          <input className="field" required value={werte.titel} placeholder="Grundlagen der Informatik" onChange={(e) => setze("titel", e.target.value)} />
        </label>
        <label>
          <span>Jahr *</span>
          <input
            className="field"
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
          <input className="field" value={werte.verlag} placeholder={werte.typ === "ARTIKEL" ? "Informatik Spektrum, 44(2)" : "Springer"} onChange={(e) => setze("verlag", e.target.value)} />
        </label>
        <label className={web ? "lit-breit" : ""}>
          <span>URL{web ? " *" : ""}</span>
          <input className="field" type="url" required={web} value={werte.url} placeholder="https://…" onChange={(e) => setze("url", e.target.value)} />
        </label>
        <label>
          <span>Abgerufen am{web ? " *" : ""}</span>
          <input className="field" type="date" required={web} value={werte.abgerufenAm} onChange={(e) => setze("abgerufenAm", e.target.value)} />
        </label>
        <label>
          <span>Seiten</span>
          <input className="field" value={werte.seiten} placeholder="45–60" onChange={(e) => setze("seiten", e.target.value)} />
        </label>
        <label>
          <span>Fach</span>
          <select className="field" value={werte.fachId ?? ""} onChange={(e) => setze("fachId", e.target.value || null)}>
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
          <select className="field" value={werte.dateiId ?? ""} onChange={(e) => setze("dateiId", e.target.value || null)}>
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
          <textarea className="field" rows={2} value={werte.notiz} placeholder="gutes Kapitel zu Automaten" onChange={(e) => setze("notiz", e.target.value)} />
        </label>
      </div>
      {vorschau && (
        <p className="lit-vorschau">
          <span className="faint">Vorschau: </span>
          {vorschau}
        </p>
      )}
      {fehler && <p className="auth-error">{fehler}</p>}
      <div className="hub-formular-knoepfe">
        <button type="button" className="btng" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <button type="submit" className="btnp" disabled={laeuft}>
          {laeuft ? "…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
