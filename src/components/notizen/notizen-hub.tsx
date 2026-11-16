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
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { markdownAlsText } from "@/lib/markdown-text";
import { DiktatKnopf } from "@/components/ki/diktat-knopf";
import { SPEICHER_TEXT, useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { KiKartenDialog } from "@/components/notizen/ki-karten-dialog";
import { KiZusammenfassungDialog } from "@/components/notizen/ki-zusammenfassung-dialog";
import { KiMindmapDialog } from "@/components/notizen/ki-mindmap-dialog";
import { KiMenue } from "@/components/ki/ki-menue";
import { KiMarkierung } from "@/components/ki/ki-markierung";
import { MIN_MINDMAP_ZEICHEN, mindmapMoeglich } from "@/lib/ki/mindmap";
import { MIN_ZUSAMMENFASSUNG_ZEICHEN, zusammenfassungMoeglich } from "@/lib/ki/zusammenfassung";
import { MIN_NOTIZ_ZEICHEN, notizLangGenug } from "@/lib/ki/karten";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { istPdfName, tagsFinden, wikilinksFinden, zielZerlegen } from "@/lib/notizen/wikilinks";
import { VORLAGEN, type VorlageId } from "@/lib/notizen/vorlagen";
import { browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";
import { NotizEditorFlaeche } from "@/components/notizen/notiz-editor-flaeche";
import type { LinkZiel } from "@/components/notizen/werkzeugleiste";
import type { LinkAufloesung } from "@/components/notizen/editor-erweiterungen";

export type LaufendeVorlesung = { stundenplanEintragId: string; fachName: string; vorhandeneNotizId: string | null };
export type PdfOption = { id: string; name: string };

const OHNE_TITEL = "Unbenannte Notiz";
const TABS_SCHLUESSEL = "uniwars-notiz-tabs";
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

function PinIcon({ an }: { an: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={an ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z" />
      <path d="M12 13v8" strokeLinecap="round" />
    </svg>
  );
}

export function NotizenHub({
  initialNotizen,
  faecher,
  laufendeVorlesung,
  kiVerfuegbar,
  pdfs = [],
}: {
  initialNotizen: Notiz[];
  faecher: FachOption[];
  laufendeVorlesung: LaufendeVorlesung | null;
  /** KI-01: ist ein KI-Schlüssel hinterlegt? */
  kiVerfuegbar: boolean;
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

  // Strg+O / ⌘+O: Schnellsuche (wie in Obsidian); Alt+←/→: zurück/vor
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setSchnellsuche(true);
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

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

  function loeschen(n: Notiz) {
    if (!window.confirm(`„${n.titel || OHNE_TITEL}“ wirklich löschen?`)) return;
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
        if (window.confirm(`Die Notiz „${name}“ gibt es noch nicht. Jetzt anlegen?`)) neu("leer", name);
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

  return (
    <>
      <HubKopf
        titel="Notizen"
        untertitel="Mitschriften mit Formatierungen wie in Word – und Verlinkungen zwischen Notizen und PDFs."
        aktionen={
          <div className="notiz-kopf-aktionen">
            <button type="button" className="btng" onClick={() => setSchnellsuche(true)} title="Notiz suchen und öffnen (Strg+O)">
              🔍 Öffnen <kbd>Strg+O</kbd>
            </button>
            <div className="notiz-neu-gruppe">
              <button type="button" className="btnp" onClick={() => neu()} disabled={isPending}>
                + Neue Notiz
              </button>
              <button type="button" className="btnp notiz-neu-pfeil" aria-label="Aus Vorlage" title="Aus Vorlage" aria-expanded={vorlagenOffen} onClick={() => setVorlagenOffen((o) => !o)} disabled={isPending}>
                ▾
              </button>
              {vorlagenOffen && (
                <div className="notiz-vorlagen card">
                  {VORLAGEN.map((v) => (
                    <button key={v.id} type="button" onClick={() => neu(v.id)}>
                      <strong>{v.name}</strong>
                      <span className="muted">{v.beschreibung}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
      />
      <FachFilterChips faecher={faecher} />
      {fehler && <p className="auth-error">{fehler}</p>}

      {vorlesungHinweis && laufendeVorlesung && (
        <button type="button" className="hub-vorschlag" onClick={() => mitschrift(laufendeVorlesung)} disabled={isPending}>
          <span aria-hidden>🎓</span> Gerade läuft {laufendeVorlesung.fachName}. <strong>{vorlesungHinweis}</strong>
        </button>
      )}

      {schnellsuche && <Schnellsuche notizen={notizen} onWahl={(id) => (setSchnellsuche(false), oeffnen(id))} onNeu={(t) => (setSchnellsuche(false), neu("leer", t))} onSchliessen={() => setSchnellsuche(false)} />}

      {notizen.length === 0 ? (
        <LeererZustand
          icon="📝"
          text="Noch keine Notizen. Halte hier fest, was in der Vorlesung wichtig war."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={() => neu()} disabled={isPending}>
              + Erste Notiz anlegen
            </button>
          }
        />
      ) : (
        <div className="hub-zweispaltig notiz-layout" data-ansicht={auswahl ? "inhalt" : "liste"}>
          <section className="card hub-liste" aria-label="Notizliste">
            <input type="search" className="field" placeholder="Notizen durchsuchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            {alleTags.length > 0 && (
              <div className="notiz-tags" aria-label="Tags">
                {alleTags.map(([t, n]) => (
                  <button key={t} type="button" className={`notiz-tag ${tagFilter === t ? "an" : ""}`} onClick={() => setTagFilter((alt) => (alt === t ? null : t))} title={`${n} Notiz${n === 1 ? "" : "en"}`}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
            <ul className="notiz-liste">
              {sichtbar.length === 0 && <li className="empty-state hub-liste-leer">Keine passenden Notizen.</li>}
              {sichtbar.map((n) => {
                const fach = fachVon(n.fach_id);
                const vorschau = markdownAlsText(n.inhalt.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_g, z: string, l?: string) => l ?? z)).slice(0, 60);
                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`notiz-zeile ${n.id === auswahlId ? "aktiv" : ""}`}
                      onClick={(e) => (e.ctrlKey || e.metaKey ? inZweiterAnsichtOeffnen(`/notizen?id=${n.id}`, "rechts") : oeffnen(n.id))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          oeffnen(n.id);
                        }
                      }}
                    >
                      <div className="notiz-zeile-kopf">
                        {fach && <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} title={fach.name} />}
                        <span className={`notiz-zeile-titel ${n.titel ? "" : "faint"}`}>
                          {n.titel || OHNE_TITEL} <KiMarkierung an={n.ki_erzeugt} />
                        </span>
                        <button
                          type="button"
                          className={`icon-knopf pin ${n.angepinnt ? "an" : ""}`}
                          aria-label={n.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
                          title={n.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
                          onClick={(e) => {
                            e.stopPropagation();
                            anpinnen(n);
                          }}
                        >
                          <PinIcon an={n.angepinnt} />
                        </button>
                      </div>
                      <div className="notiz-zeile-vorschau">{vorschau || <span className="faint">Kein Text</span>}</div>
                      <div className="notiz-zeile-datum faint">{kurzDatum(n.geaendert_am)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="hub-inhalt notiz-inhalt" aria-label="Notiz">
            {tabs.length > 0 && (
              <div className="notiz-tabs" role="tablist" aria-label="Geöffnete Notizen">
                <button type="button" className="icon-knopf" title="Zurück (wie im Browser)" aria-label="Zurück" onClick={() => router.back()}>
                  ←
                </button>
                <button type="button" className="icon-knopf" title="Vor" aria-label="Vor" onClick={() => window.history.forward()}>
                  →
                </button>
                {tabs.map((id) => {
                  const n = notizen.find((x) => x.id === id);
                  if (!n) return null;
                  return (
                    <span key={id} role="tab" aria-selected={id === auswahlId} className={`notiz-tab ${id === auswahlId ? "an" : ""}`}>
                      <button type="button" className="notiz-tab-titel" onClick={() => oeffnen(id)} title={n.titel || OHNE_TITEL}>
                        {n.titel || OHNE_TITEL}
                      </button>
                      <button type="button" className="notiz-tab-zu" aria-label="Tab schließen" onClick={() => tabSchliessen(id)}>
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="card notiz-karte">
              {auswahl ? (
                <NotizEditor
                  key={auswahl.id}
                  notiz={auswahl}
                  alleNotizen={notizen}
                  faecher={faecher}
                  ziele={ziele}
                  aufloesen={aufloesen}
                  onLinkOeffnen={linkOeffnen}
                  kiVerfuegbar={kiVerfuegbar}
                  autoFokusTitel={auswahl.id === neuId}
                  onZurueck={() => oeffnen(null)}
                  onLokal={(teil) => aktualisieren(auswahl.id, teil)}
                  onAngepasst={(liste) => setNotizen((alt) => alt.map((n) => liste.find((x) => x.id === n.id) ? { ...n, inhalt: liste.find((x) => x.id === n.id)!.inhalt } : n))}
                  onAnpinnen={() => anpinnen(auswahl)}
                  onLoeschen={() => loeschen(auswahl)}
                  onNotizOeffnen={oeffnen}
                  onNeueNotiz={(n) => {
                    setNotizen((liste) => sortieren([n, ...liste]));
                    oeffnen(n.id);
                  }}
                />
              ) : (
                <p className="empty-state hub-inhalt-leer">Wähle links eine Notiz aus, öffne eine mit Strg+O – oder lege eine neue an.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
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
      className="card notiz-schnellsuche"
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
        className="field"
        autoFocus
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
              📝 {n.titel || OHNE_TITEL}
              <span className="faint">{kurzDatum(n.geaendert_am)}</span>
            </button>
          </li>
        ))}
        {neuerTitel && (
          <li>
            <button type="button" className={index === treffer.length ? "an" : ""} onClick={() => onNeu(neuerTitel)}>
              ＋ Neue Notiz „{neuerTitel}“
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
  kiVerfuegbar,
  autoFokusTitel,
  onZurueck,
  onLokal,
  onAngepasst,
  onAnpinnen,
  onLoeschen,
  onNotizOeffnen,
  onNeueNotiz,
}: {
  notiz: Notiz;
  alleNotizen: Notiz[];
  faecher: FachOption[];
  ziele: LinkZiel[];
  aufloesen: (ziel: string) => LinkAufloesung;
  onLinkOeffnen: (ziel: string, daneben: boolean) => void;
  kiVerfuegbar: boolean;
  autoFokusTitel: boolean;
  onZurueck: () => void;
  onLokal: (teil: Partial<Notiz>) => void;
  onAngepasst: (liste: { id: string; inhalt: string }[]) => void;
  onAnpinnen: () => void;
  onLoeschen: () => void;
  onNotizOeffnen: (id: string) => void;
  onNeueNotiz: (n: Notiz) => void;
}) {
  const [titel, setTitel] = useState(notiz.titel);
  const [kiDialog, setKiDialog] = useState<"karten" | "zusammenfassung" | "mindmap" | null>(null);
  // Nach "Zusammenfassung oben einfügen" den Editor mit dem neuen Inhalt neu aufbauen
  const [editorVersion, setEditorVersion] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [gliederung, setGliederung] = useState<Ueberschrift[]>([]);
  const { status, aendern, jetztSpeichern } = useAutoSpeichern<{ titel: string; inhalt: string }>(async (aenderung) => {
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
        <button type="button" className="btng hub-zurueck" onClick={onZurueck}>
          ← Zurück
        </button>
        <label className="notiz-fach">
          <span className="muted">Fach:</span>
          <select className="field" value={notiz.fach_id ?? ""} onChange={(e) => fachAendern(e.target.value)}>
            <option value="">Ohne Fach</option>
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <span className={`speicher-status ${status}`} aria-live="polite">
          {SPEICHER_TEXT[status]}
        </span>
        <button
          type="button"
          className={`icon-knopf pin ${notiz.angepinnt ? "an" : ""}`}
          aria-label={notiz.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
          title={notiz.angepinnt ? "Nicht mehr anpinnen" : "Anpinnen"}
          onClick={onAnpinnen}
        >
          <PinIcon an={notiz.angepinnt} />
        </button>
        <KiMenue
          verfuegbar={kiVerfuegbar}
          punkte={[
            {
              label: "Karteikarten erstellen",
              beschreibung: "Vorschläge prüfen, dann in einen Stapel übernehmen",
              gesperrt: notizLangGenug(notiz.inhalt) ? null : `Die Notiz ist zu kurz (mindestens ${MIN_NOTIZ_ZEICHEN} Zeichen).`,
              onClick: () => setKiDialog("karten"),
            },
            {
              label: "Zusammenfassen",
              beschreibung: "Stichpunkte und offene Punkte",
              gesperrt: zusammenfassungMoeglich(notiz.inhalt) ? null : `Die Notiz ist zu kurz (mindestens ${MIN_ZUSAMMENFASSUNG_ZEICHEN} Zeichen).`,
              onClick: () => setKiDialog("zusammenfassung"),
            },
            {
              label: "Als MindMap",
              beschreibung: "Struktur prüfen, dann als neue MindMap anlegen",
              gesperrt: mindmapMoeglich(notiz.inhalt) ? null : `Die Notiz ist zu kurz (mindestens ${MIN_MINDMAP_ZEICHEN} Zeichen).`,
              onClick: () => setKiDialog("mindmap"),
            },
          ]}
        />
        <DreiPunkteMenue
          punkte={[
            { label: "Daneben öffnen", onClick: () => inZweiterAnsichtOeffnen(`/notizen?id=${notiz.id}`, "rechts") },
            { label: "Löschen", onClick: onLoeschen, gefahr: true },
          ]}
        />
      </div>

      {kiDialog === "karten" && (
        <KiKartenDialog notiz={{ id: notiz.id, titel: titel || notiz.titel, fach_id: notiz.fach_id }} faecher={faecher} vorher={jetztSpeichern} onSchliessen={() => setKiDialog(null)} />
      )}
      {kiDialog === "zusammenfassung" && (
        <KiZusammenfassungDialog
          notizId={notiz.id}
          vorher={jetztSpeichern}
          onSchliessen={() => setKiDialog(null)}
          onUebernommen={(n, modus) => {
            setKiDialog(null);
            if (modus === "oben") {
              onLokal({ inhalt: n.inhalt, geaendert_am: n.geaendert_am });
              setEditorVersion((v) => v + 1);
            } else {
              onNeueNotiz(n);
            }
          }}
        />
      )}
      {kiDialog === "mindmap" && <KiMindmapDialog notizId={notiz.id} fachId={notiz.fach_id} vorher={jetztSpeichern} onSchliessen={() => setKiDialog(null)} />}

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
              <h4>Gliederung</h4>
              <ul className="notiz-gliederung">
                {gliederung.map((u) => (
                  <li key={u.pos} style={{ paddingLeft: (u.ebene - 1) * 10 }}>
                    <button type="button" onClick={() => zuUeberschrift(u.pos)}>
                      {u.text || "…"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h4>Verlinkt von {rueckverweise.length > 0 && <span className="faint">{rueckverweise.length}</span>}</h4>
            {rueckverweise.length === 0 ? (
              <p className="faint">Noch keine Notiz verweist hierher.</p>
            ) : (
              <ul className="notiz-verweise">
                {rueckverweise.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={(e) => (e.ctrlKey || e.metaKey ? inZweiterAnsichtOeffnen(`/notizen?id=${n.id}`, "rechts") : onNotizOeffnen(n.id))}>
                      📝 {n.titel || OHNE_TITEL}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {ausgehend.length > 0 && (
            <section>
              <h4>Verlinkt in dieser Notiz</h4>
              <ul className="notiz-verweise">
                {ausgehend.map((l) => {
                  const art = aufloesen(l.name).art;
                  return (
                    <li key={`${l.name}#${l.seite ?? ""}`}>
                      <button type="button" className={art === "fehlt" ? "fehlt" : ""} onClick={(e) => onLinkOeffnen(l.seite ? `${l.name}#S${l.seite}` : l.name, e.ctrlKey || e.metaKey)}>
                        {istPdfName(l.name) ? "📕" : "📝"} {l.name}
                        {l.seite ? ` · S. ${l.seite}` : ""}
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
