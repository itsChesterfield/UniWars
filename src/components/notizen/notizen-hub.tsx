"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/react";
import {
  mitschriftAnlegen,
  notizAnlegen,
  notizAnpinnen,
  notizFachSetzen,
  notizLoeschen,
  notizSpeichern,
  type Notiz,
} from "@/app/(hubs)/notizen/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { markdownAlsText } from "@/lib/markdown-text";
import { DiktatKnopf } from "@/components/ki/diktat-knopf";
import { useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { KiMarkierung } from "@/components/ki/ki-markierung";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { istPdfName, tagsFinden, wikilinksFinden, zielZerlegen } from "@/lib/notizen/wikilinks";
import { VORLAGEN, type VorlageId } from "@/lib/notizen/vorlagen";
import { browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";
import { NotizEditorFlaeche } from "@/components/notizen/notiz-editor-flaeche";
import type { LinkZiel } from "@/components/notizen/werkzeugleiste";
import type { LinkAufloesung } from "@/components/notizen/editor-erweiterungen";
import { SpeicherStatusAnzeige } from "@/components/bewegung/speicher-status";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { inDenPapierkorb, rueckfrage } from "@/components/rueckfrage";
import { kopfListe } from "@/lib/bereichskopf";

export type LaufendeVorlesung = { stundenplanEintragId: string; fachName: string; vorhandeneNotizId: string | null };
export type PdfOption = { id: string; name: string };

const OHNE_TITEL = "Unbenannte Notiz";
const TABS_SCHLUESSEL = "uniwars-notiz-tabs";
/** Notizliste neben einer offenen Notiz anzeigen? (Standard: eingeklappt – die Notiz bekommt den Platz) */
const LISTE_SCHLUESSEL = "uniwars-notiz-liste";
const MAX_TABS = 8;

// NOT-03: angepinnt zuerst, dann zuletzt geändert (ALL-06)
function sortieren(liste: Notiz[]) {
  return [...liste].sort((a, b) => Number(b.angepinnt) - Number(a.angepinnt) || b.geaendert_am.localeCompare(a.geaendert_am));
}

function kurzDatum(iso: string) {
  const d = new Date(iso);
  const heute = new Date();
  if (d.toDateString() === heute.toDateString()) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", ...(d.getFullYear() !== heute.getFullYear() ? { year: "2-digit" } : {}) });
}

function tabsLesen(roh: string): string[] {
  try {
    const wert = JSON.parse(roh) as unknown;
    return Array.isArray(wert) ? wert.filter((x): x is string => typeof x === "string").slice(0, MAX_TABS) : [];
  } catch {
    return [];
  }
}

export function NotizenHub({
  initialNotizen,
  faecher,
  laufendeVorlesung,
  pdfs = [],
}: {
  initialNotizen: Notiz[];
  faecher: FachOption[];
  laufendeVorlesung: LaufendeVorlesung | null;
  /** früher KI-01 (KI läuft jetzt über UniVerse Studio, Strg+J) */
  kiVerfuegbar?: boolean;
  /** PDFs zum Verlinken */
  pdfs?: PdfOption[];
}) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const fachFilter = searchParams.get("fachId");
  const auswahlId = searchParams.get("id");

  const [notizen, setNotizen] = useState(() => sortieren(initialNotizen));
  const [suche, setSuche] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [neuId, setNeuId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [schnellsuche, setSchnellsuche] = useState(false);
  const [vorlagenOffen, setVorlagenOffen] = useState(false);

  const tabs = tabsLesen(useBrowserWert(TABS_SCHLUESSEL, "[]")).filter((id) => notizen.some((n) => n.id === id));
  const listeOffen = useBrowserWert(LISTE_SCHLUESSEL, "0") === "1";
  const listeUmschalten = () => browserWertSchreiben(LISTE_SCHLUESSEL, listeOffen ? null : "1");

  const fachVon = (id: string | null) => faecher.find((f) => f.id === id) ?? null;

  const alleTags = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const n of notizen) for (const t of tagsFinden(n.inhalt)) zaehler.set(t, (zaehler.get(t) ?? 0) + 1);
    return [...zaehler.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
  }, [notizen]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return notizen.filter(
      (n) =>
        (!fachFilter || n.fach_id === fachFilter) &&
        (!tagFilter || tagsFinden(n.inhalt).includes(tagFilter)) &&
        (!q || n.titel.toLowerCase().includes(q) || n.inhalt.toLowerCase().includes(q)),
    );
  }, [notizen, fachFilter, suche, tagFilter]);

  const auswahl = notizen.find((n) => n.id === auswahlId) ?? null;

  // Zuletzt geöffnete Notizen als Tabs
  useEffect(() => {
    if (!auswahlId) return;
    const aktuell = tabsLesen(window.localStorage.getItem(TABS_SCHLUESSEL) ?? "[]");
    if (aktuell.includes(auswahlId)) return;
    browserWertSchreiben(TABS_SCHLUESSEL, JSON.stringify([...aktuell, auswahlId].slice(-MAX_TABS)));
  }, [auswahlId]);

  function tabSchliessen(id: string) {
    const rest = tabs.filter((t) => t !== id);
    browserWertSchreiben(TABS_SCHLUESSEL, JSON.stringify(rest));
    if (id === auswahlId) oeffnen(rest[rest.length - 1] ?? null);
  }

  const oeffnen = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("id", id);
      else params.delete("id");
      const query = params.toString();
      router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
    },
    [pfad, router, searchParams],
  );

  function aktualisieren(id: string, teil: Partial<Notiz>) {
    setNotizen((liste) => sortieren(liste.map((n) => (n.id === id ? { ...n, ...teil } : n))));
  }

  function neu(vorlage: VorlageId = "leer", titel?: string) {
    setFehler(null);
    setVorlagenOffen(false);
    startTransition(async () => {
      try {
        const notiz = await notizAnlegen(fachFilter, vorlage, titel);
        setNotizen((liste) => sortieren([notiz, ...liste]));
        setNeuId(notiz.id);
        setSuche("");
        oeffnen(notiz.id);
        track("notiz_angelegt", { mit_fach: Boolean(fachFilter), mitschrift: false, vorlage, aus_link: Boolean(titel) });
      } catch (err) {
        setFehler("Notiz konnte nicht angelegt werden.");
        fehlerMelden(err, { ort: "notiz_anlegen" });
      }
    });
  }

  function mitschrift(v: LaufendeVorlesung) {
    if (v.vorhandeneNotizId && notizen.some((n) => n.id === v.vorhandeneNotizId)) {
      oeffnen(v.vorhandeneNotizId);
      return;
    }
    startTransition(async () => {
      try {
        const notiz = await mitschriftAnlegen(v.stundenplanEintragId);
        setNotizen((liste) => sortieren([notiz, ...liste.filter((n) => n.id !== notiz.id)]));
        setNeuId(notiz.id);
        oeffnen(notiz.id);
        track("notiz_angelegt", { mit_fach: true, mitschrift: true });
      } catch (err) {
        setFehler("Mitschrift konnte nicht angelegt werden.");
        fehlerMelden(err, { ort: "mitschrift_anlegen" });
      }
    });
  }

  function anpinnen(n: Notiz) {
    aktualisieren(n.id, { angepinnt: !n.angepinnt });
    track("notiz_angepinnt", { angepinnt: !n.angepinnt });
    notizAnpinnen(n.id, !n.angepinnt).catch(() => aktualisieren(n.id, { angepinnt: n.angepinnt }));
  }

  async function loeschen(n: Notiz) {
    if (!(await inDenPapierkorb(`Die Notiz „${n.titel || OHNE_TITEL}“`))) return;
    setNotizen((liste) => liste.filter((x) => x.id !== n.id));
    tabSchliessen(n.id);
    oeffnen(null);
    track("notiz_geloescht");
    notizLoeschen(n.id).catch((err) => {
      setNotizen((liste) => sortieren([n, ...liste]));
      setFehler("Löschen hat nicht geklappt.");
      fehlerMelden(err, { ort: "notiz_loeschen" });
    });
  }

  // --- Verlinkungen -----------------------------------------------------------
  const ziele: LinkZiel[] = useMemo(
    () => [
      ...notizen.filter((n) => n.titel.trim()).map((n) => ({ id: n.id, name: n.titel.trim(), art: "notiz" as const })),
      ...pdfs.map((p) => ({ id: p.id, name: p.name, art: "pdf" as const })),
    ],
    [notizen, pdfs],
  );

  const notizNachTitel = useCallback(
    (name: string) => notizen.find((n) => n.titel.trim().toLowerCase() === name.trim().toLowerCase()) ?? null,
    [notizen],
  );
  const pdfNachName = useCallback((name: string) => pdfs.find((p) => p.name.toLowerCase() === name.trim().toLowerCase()) ?? null, [pdfs]);

  const aufloesen = useCallback(
    (ziel: string): LinkAufloesung => {
      const { name } = zielZerlegen(ziel);
      if (istPdfName(name)) return { art: pdfNachName(name) ? "pdf" : "fehlt" };
      return { art: notizNachTitel(name) ? "notiz" : "fehlt" };
    },
    [notizNachTitel, pdfNachName],
  );

  const linkOeffnen = useCallback(
    (ziel: string, daneben: boolean) => {
      const { name, seite } = zielZerlegen(ziel);
      if (istPdfName(name)) {
        const pdf = pdfNachName(name);
        if (!pdf) {
          window.alert(`Die PDF „${name}“ gibt es (noch) nicht in deiner Dateiablage.`);
          return;
        }
        track("notiz_link_geoeffnet", { art: "pdf", mit_seite: Boolean(seite) });
        // PDFs immer daneben – die Notiz bleibt offen
        inZweiterAnsichtOeffnen(`/pdf-reader/${pdf.id}${seite ? `?seite=${seite}` : ""}`, "rechts");
        return;
      }
      const notiz = notizNachTitel(name);
      track("notiz_link_geoeffnet", { art: "notiz", daneben, neu: !notiz });
      if (!notiz) {
        void rueckfrage({ titel: "Notiz anlegen?", text: `Die Notiz „${name}“ gibt es noch nicht.`, ja: "Anlegen" }).then((ja) => ja && neu("leer", name));
        return;
      }
      if (daneben) inZweiterAnsichtOeffnen(`/notizen?id=${notiz.id}`, "rechts");
      else oeffnen(notiz.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu() nutzt nur stabile Setter
    [notizNachTitel, pdfNachName, oeffnen],
  );

  const vorlesungHinweis =
    laufendeVorlesung &&
    (laufendeVorlesung.vorhandeneNotizId ? `Mitschrift für ${laufendeVorlesung.fachName} öffnen` : `Mitschrift für ${laufendeVorlesung.fachName} anlegen?`);

  const filterAktiv = Boolean(suche.trim() || tagFilter);
  const neuKnopf = (klasse: string, text: string) => (
    <button type="button" className={`knopf ${klasse}`} onClick={() => neu()} disabled={isPending} aria-busy={isPending}>
      <Icon name="plus" groesse={16} />
      {text}
    </button>
  );

  return (
    <>
      <Bereichskopf
        titel="Notizen"
        untertitel="Mitschriften mit Formatierungen wie in Word und Verlinkungen zwischen Notizen und PDFs."
        {...(notizen.length ? kopfListe(notizen.map((n) => ({ titel: n.titel, geaendert: n.geaendert_am })), "Unbenannte Notiz", ["Notiz", "Notizen"]) : {})}
        aktionen={notizen.length > 0 && (
          <>
            <button type="button" className="knopf leise" onClick={() => setSchnellsuche(true)} title="Notiz suchen und öffnen (alles andere: Strg+O)">
              <Icon name="suchen" groesse={16} />
              Öffnen
            </button>
            <button type="button" className="knopf neben" onClick={() => setVorlagenOffen(true)} disabled={isPending}>
              Aus Vorlage
            </button>
            {neuKnopf("haupt", "Neue Notiz")}
          </>
        )}
      />
      <FachFilterChips faecher={faecher} />
      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}

      {vorlesungHinweis && laufendeVorlesung && (
        <div className="notiz-vorlesung">
          <Icon name="uhr" groesse={18} />
          <span>Gerade läuft {laufendeVorlesung.fachName}.</span>
          <button type="button" className="knopf neben klein" onClick={() => mitschrift(laufendeVorlesung)} disabled={isPending}>
            {vorlesungHinweis}
          </button>
        </div>
      )}

      {vorlagenOffen && <VorlagenDialog onWahl={(id) => neu(id)} onSchliessen={() => setVorlagenOffen(false)} />}

      {schnellsuche && <Schnellsuche notizen={notizen} onWahl={(id) => (setSchnellsuche(false), oeffnen(id))} onNeu={(t) => (setSchnellsuche(false), neu("leer", t))} onSchliessen={() => setSchnellsuche(false)} />}

      {notizen.length === 0 ? (
        <Zustand art="leer" icon="notizen" titel="Noch keine Notizen." aktion={neuKnopf("neben klein", "Erste Notiz anlegen")}>
          Halte hier fest, was in der Vorlesung wichtig war. Mit [[ ]] verlinkst du Notizen und PDFs.
        </Zustand>
      ) : (
        <div className="notiz-layout" data-ansicht={auswahl ? "inhalt" : "liste"} data-liste={auswahl && !listeOffen ? "zu" : "auf"}>
          <section className="notiz-spalte" aria-label="Notizliste">
            <div className="notiz-spalte-kopf">
              <input type="search" className="notiz-suche" aria-label="Notizen durchsuchen" placeholder="Notizen durchsuchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
              {auswahl && (
                <button type="button" className="knopf leise klein nur-symbol" onClick={listeUmschalten} aria-label="Liste einklappen" title="Liste einklappen, mehr Platz für die Notiz">
                  <Icon name="pfeil-links" groesse={16} />
                </button>
              )}
            </div>
            {alleTags.length > 0 && (
              <div className="notiz-tags" role="group" aria-label="Tags">
                {alleTags.map(([t, n]) => (
                  <button key={t} type="button" className="filter-chip" aria-pressed={tagFilter === t} onClick={() => setTagFilter((alt) => (alt === t ? null : t))} title={`${n} Notiz${n === 1 ? "" : "en"}`}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
            {sichtbar.length === 0 ? (
              filterAktiv ? (
                <Zustand
                  art="leer"
                  icon="suchen"
                  titel="Keine passenden Notizen."
                  region
                  ebene={3}
                  aktion={
                    <button type="button" className="knopf neben klein" onClick={() => (setSuche(""), setTagFilter(null))}>
                      Suche zurücksetzen
                    </button>
                  }
                />
              ) : (
                <Zustand art="leer" icon="notizen" titel="In diesem Fach gibt es noch keine Notiz." region ebene={3} aktion={neuKnopf("neben klein", "Notiz anlegen")} />
              )
            ) : (
              <ul className="notiz-liste">
                {sichtbar.map((n) => {
                  const fach = fachVon(n.fach_id);
                  const vorschau = markdownAlsText(n.inhalt.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_g, z: string, l?: string) => l ?? z)).slice(0, 60);
                  return (
                    <li key={n.id} className="notiz-eintrag">
                      <button
                        type="button"
                        className="notiz-oeffnen"
                        aria-current={n.id === auswahlId ? "true" : undefined}
                        onClick={(e) => (e.ctrlKey || e.metaKey ? inZweiterAnsichtOeffnen(`/notizen?id=${n.id}`, "rechts") : oeffnen(n.id))}
                      >
                        <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--linie-2)" } as React.CSSProperties} title={fach?.name} aria-hidden />
                        <span className={`notiz-name${n.titel ? "" : " ohne"}`}>
                          {n.titel || OHNE_TITEL} <KiMarkierung an={n.ki_erzeugt} />
                        </span>
                        <span className="notiz-vorschau">{vorschau || "Kein Text"}</span>
                        <span className="notiz-datum">{kurzDatum(n.geaendert_am)}</span>
                      </button>
                      <button
                        type="button"
                        className="knopf leise klein nur-symbol"
                        aria-pressed={n.angepinnt}
                        aria-label={`${n.titel || OHNE_TITEL} anpinnen`}
                        title={n.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
                        onClick={() => anpinnen(n)}
                      >
                        <Icon name="anheften" groesse={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="notiz-inhalt" aria-label="Notiz">
            {(tabs.length > 0 || auswahl) && (
              <nav className="notiz-reiter" aria-label="Geöffnete Notizen">
                {auswahl && !listeOffen && (
                  <button type="button" className="knopf leise klein nur-symbol notiz-liste-auf" title="Alle Notizen anzeigen" aria-label="Notizliste anzeigen" onClick={listeUmschalten}>
                    <Icon name="menue" groesse={16} />
                  </button>
                )}
                <button type="button" className="knopf leise klein nur-symbol" title="Zurück (wie im Browser)" aria-label="Zurück" onClick={() => router.back()}>
                  <Icon name="pfeil-links" groesse={16} />
                </button>
                <button type="button" className="knopf leise klein nur-symbol" title="Vor" aria-label="Vor" onClick={() => window.history.forward()}>
                  <Icon name="pfeil-rechts" groesse={16} />
                </button>
                <ul>
                  {tabs.map((id) => {
                    const n = notizen.find((x) => x.id === id);
                    if (!n) return null;
                    return (
                      <li key={id}>
                        <button type="button" className="notiz-reiter-titel" aria-current={id === auswahlId ? "page" : undefined} onClick={() => oeffnen(id)} title={n.titel || OHNE_TITEL}>
                          {n.titel || OHNE_TITEL}
                        </button>
                        <button type="button" className="notiz-reiter-zu" aria-label={`${n.titel || OHNE_TITEL} schließen`} onClick={() => tabSchliessen(id)}>
                          <Icon name="schliessen" groesse={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
            {auswahl ? (
              <NotizEditor
                key={auswahl.id}
                notiz={auswahl}
                alleNotizen={notizen}
                faecher={faecher}
                ziele={ziele}
                aufloesen={aufloesen}
                onLinkOeffnen={linkOeffnen}
                autoFokusTitel={auswahl.id === neuId}
                onZurueck={() => oeffnen(null)}
                onLokal={(teil) => aktualisieren(auswahl.id, teil)}
                onAngepasst={(liste) => setNotizen((alt) => alt.map((n) => liste.find((x) => x.id === n.id) ? { ...n, inhalt: liste.find((x) => x.id === n.id)!.inhalt } : n))}
                onAnpinnen={() => anpinnen(auswahl)}
                onLoeschen={() => loeschen(auswahl)}
                onNotizOeffnen={oeffnen}
              />
            ) : (
              <Zustand art="leer" icon="notizen" titel="Keine Notiz geöffnet." region ebene={2}>
                Wähle links eine Notiz, öffne eine über „Öffnen“ oder lege eine neue an.
              </Zustand>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/** Neue Notiz aus einer Vorlage */
function VorlagenDialog({ onWahl, onSchliessen }: { onWahl: (id: VorlageId) => void; onSchliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="formular-dialog notiz-vorlagen"
      aria-labelledby="notiz-vorlagen-titel"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onSchliessen();
      }}
    >
      <h2 id="notiz-vorlagen-titel">Neue Notiz aus Vorlage</h2>
      <ul>
        {VORLAGEN.map((v) => (
          <li key={v.id}>
            <button type="button" onClick={() => onWahl(v.id)}>
              {v.name}
              <small>{v.beschreibung}</small>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="knopf leise" onClick={onSchliessen}>
        Abbrechen
      </button>
    </dialog>
  );
}

/** Strg+O: Notiz per Name suchen und öffnen (oder neu anlegen) */
function Schnellsuche({
  notizen,
  onWahl,
  onNeu,
  onSchliessen,
}: {
  notizen: Notiz[];
  onWahl: (id: string) => void;
  onNeu: (titel: string) => void;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const s = q.trim().toLowerCase();
  const treffer = notizen
    .filter((n) => !s || n.titel.toLowerCase().includes(s) || n.inhalt.toLowerCase().includes(s))
    .sort((a, b) => Number(b.titel.toLowerCase().startsWith(s)) - Number(a.titel.toLowerCase().startsWith(s)))
    .slice(0, 10);
  const neuerTitel = s && !notizen.some((n) => n.titel.trim().toLowerCase() === s) ? q.trim() : null;
  return (
    <dialog
      ref={ref}
      className="formular-dialog notiz-schnellsuche"
      aria-label="Notiz öffnen"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onSchliessen();
      }}
    >
      <input
        autoFocus
        aria-label="Notiz suchen"
        placeholder="Notiz suchen … (Enter öffnet)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, treffer.length - (neuerTitel ? 0 : 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (treffer[index]) onWahl(treffer[index].id);
            else if (neuerTitel) onNeu(neuerTitel);
          }
        }}
      />
      <ul>
        {treffer.map((n, i) => (
          <li key={n.id}>
            <button type="button" className={i === index ? "an" : ""} onClick={() => onWahl(n.id)}>
              <Icon name="notizen" groesse={16} />
              {n.titel || OHNE_TITEL}
              <span className="notiz-datum">{kurzDatum(n.geaendert_am)}</span>
            </button>
          </li>
        ))}
        {neuerTitel && (
          <li>
            <button type="button" className={index === treffer.length ? "an" : ""} onClick={() => onNeu(neuerTitel)}>
              <Icon name="plus" groesse={16} />
              Neue Notiz „{neuerTitel}“
            </button>
          </li>
        )}
      </ul>
    </dialog>
  );
}

type Ueberschrift = { ebene: number; text: string; pos: number };

function NotizEditor({
  notiz,
  alleNotizen,
  faecher,
  ziele,
  aufloesen,
  onLinkOeffnen,
  autoFokusTitel,
  onZurueck,
  onLokal,
  onAngepasst,
  onAnpinnen,
  onLoeschen,
  onNotizOeffnen,
}: {
  notiz: Notiz;
  alleNotizen: Notiz[];
  faecher: FachOption[];
  ziele: LinkZiel[];
  aufloesen: (ziel: string) => LinkAufloesung;
  onLinkOeffnen: (ziel: string, daneben: boolean) => void;
  autoFokusTitel: boolean;
  onZurueck: () => void;
  onLokal: (teil: Partial<Notiz>) => void;
  onAngepasst: (liste: { id: string; inhalt: string }[]) => void;
  onAnpinnen: () => void;
  onLoeschen: () => void;
  onNotizOeffnen: (id: string) => void;
}) {
  const [titel, setTitel] = useState(notiz.titel);
  // Nach "Zusammenfassung oben einfügen" den Editor mit dem neuen Inhalt neu aufbauen
  const [editorVersion] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [gliederung, setGliederung] = useState<Ueberschrift[]>([]);
  const { status, aendern } = useAutoSpeichern<{ titel: string; inhalt: string }>(async (aenderung) => {
    const ergebnis = await notizSpeichern(notiz.id, aenderung);
    onLokal({ geaendert_am: ergebnis.geaendertAm });
    if (ergebnis.angepasst.length) onAngepasst(ergebnis.angepasst);
  });

  // Gliederung aus den Überschriften
  useEffect(() => {
    if (!editor) return;
    const lesen = () => {
      const liste: Ueberschrift[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") liste.push({ ebene: Number(node.attrs.level), text: node.textContent, pos });
        return node.type.name !== "heading";
      });
      setGliederung(liste);
    };
    lesen();
    editor.on("update", lesen);
    return () => {
      editor.off("update", lesen);
    };
  }, [editor]);

  // Rückverweise: andere Notizen, die auf diese verlinken
  const rueckverweise = useMemo(() => {
    const t = (titel || notiz.titel).trim().toLowerCase();
    if (!t) return [];
    return alleNotizen.filter((n) => n.id !== notiz.id && wikilinksFinden(n.inhalt).some((l) => l.name.toLowerCase() === t));
  }, [alleNotizen, notiz.id, notiz.titel, titel]);

  // Ausgehende Verlinkungen dieser Notiz
  const ausgehend = useMemo(() => wikilinksFinden(notiz.inhalt), [notiz.inhalt]);

  function fachAendern(fachId: string) {
    onLokal({ fach_id: fachId || null });
    track("notiz_fach_geaendert", { mit_fach: Boolean(fachId) });
    notizFachSetzen(notiz.id, fachId || null).catch((err) => {
      onLokal({ fach_id: notiz.fach_id });
      fehlerMelden(err, { ort: "notiz_fach" });
    });
  }

  function zuUeberschrift(pos: number) {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  }

  return (
    <div className="notiz-editor">
      <div className="notiz-editor-leiste">
        <button type="button" className="knopf leise klein notiz-zurueck" onClick={onZurueck}>
          <Icon name="pfeil-links" groesse={16} />
          Alle Notizen
        </button>
        <label className="notiz-fach">
          Fach
          <select value={notiz.fach_id ?? ""} onChange={(e) => fachAendern(e.target.value)}>
            <option value="">Ohne Fach</option>
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <SpeicherStatusAnzeige status={status} />
        <button
          type="button"
          className="knopf leise klein nur-symbol"
          aria-pressed={notiz.angepinnt}
          aria-label="Anpinnen"
          title={notiz.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
          onClick={onAnpinnen}
        >
          <Icon name="anheften" groesse={16} />
        </button>
        <DreiPunkteMenue
          label="Weitere Aktionen für diese Notiz"
          punkte={[
            { label: "Daneben öffnen", onClick: () => inZweiterAnsichtOeffnen(`/notizen?id=${notiz.id}`, "rechts") },
            { label: "Löschen", onClick: onLoeschen, gefahr: true },
          ]}
        />
      </div>

      <input
        className="notiz-titel"
        value={titel}
        placeholder={OHNE_TITEL}
        aria-label="Titel"
        maxLength={300}
        autoFocus={autoFokusTitel}
        onChange={(e) => {
          setTitel(e.target.value);
          onLokal({ titel: e.target.value });
          aendern({ titel: e.target.value });
        }}
      />

      <div className="notiz-arbeitsflaeche">
        <NotizEditorFlaeche
          key={editorVersion}
          notizId={notiz.id}
          wert={notiz.inhalt}
          platzhalter="Losschreiben … Formatieren über die Leiste oben, Verlinken mit [[ ]]"
          label="Notiztext"
          ziele={ziele.filter((z) => z.id !== notiz.id)}
          aufloesen={aufloesen}
          onLinkOeffnen={onLinkOeffnen}
          onEditor={setEditor}
          werkzeugExtra={(e) => (
            // KI-13: diktierter Text wird an der Cursorposition eingefügt
            <DiktatKnopf klasse="md-diktat" onText={(text) => e.chain().focus().insertContent({ type: "text", text: `${text} ` }).run()} />
          )}
          onAendern={(inhalt) => {
            onLokal({ inhalt });
            aendern({ inhalt });
          }}
        />

        <aside className="notiz-seite" aria-label="Gliederung und Verlinkungen">
          {gliederung.length > 0 && (
            <section>
              <h2>Gliederung</h2>
              <ul className="notiz-gliederung">
                {gliederung.map((u) => (
                  <li key={u.pos} style={{ "--einzug": `${(u.ebene - 1) * 12}px` } as React.CSSProperties}>
                    <button type="button" onClick={() => zuUeberschrift(u.pos)}>
                      {u.text || "…"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2>Verlinkt von{rueckverweise.length > 0 && `, ${rueckverweise.length}`}</h2>
            {rueckverweise.length === 0 ? (
              <p>Noch keine Notiz verweist hierher.</p>
            ) : (
              <ul className="notiz-verweise">
                {rueckverweise.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={(e) => (e.ctrlKey || e.metaKey ? inZweiterAnsichtOeffnen(`/notizen?id=${n.id}`, "rechts") : onNotizOeffnen(n.id))}>
                      <Icon name="notizen" groesse={16} />
                      {n.titel || OHNE_TITEL}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {ausgehend.length > 0 && (
            <section>
              <h2>Verlinkt in dieser Notiz</h2>
              <ul className="notiz-verweise">
                {ausgehend.map((l) => {
                  const art = aufloesen(l.name).art;
                  return (
                    <li key={`${l.name}#${l.seite ?? ""}`}>
                      <button type="button" className={art === "fehlt" ? "fehlt" : ""} onClick={(e) => onLinkOeffnen(l.seite ? `${l.name}#S${l.seite}` : l.name, e.ctrlKey || e.metaKey)}>
                        <Icon name={istPdfName(l.name) ? "pdf" : "notizen"} groesse={16} />
                        {l.name}
                        {l.seite ? `, S. ${l.seite}` : ""}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
