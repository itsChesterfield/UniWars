"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { MarkdownEditor, markdownAlsText } from "@/components/hubs/markdown-editor";
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

export type LaufendeVorlesung = { stundenplanEintragId: string; fachName: string; vorhandeneNotizId: string | null };

const OHNE_TITEL = "Unbenannte Notiz";

// NOT-03: angepinnt zuerst, dann zuletzt geändert (ALL-06)
function sortieren(liste: Notiz[]) {
  return [...liste].sort(
    (a, b) => Number(b.angepinnt) - Number(a.angepinnt) || b.geaendert_am.localeCompare(a.geaendert_am),
  );
}

function kurzDatum(iso: string) {
  const d = new Date(iso);
  const heute = new Date();
  if (d.toDateString() === heute.toDateString()) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    ...(d.getFullYear() !== heute.getFullYear() ? { year: "2-digit" } : {}),
  });
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
}: {
  initialNotizen: Notiz[];
  faecher: FachOption[];
  laufendeVorlesung: LaufendeVorlesung | null;
  /** KI-01: ist ein KI-Schlüssel hinterlegt? */
  kiVerfuegbar: boolean;
}) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const fachFilter = searchParams.get("fachId");
  const auswahlId = searchParams.get("id");

  const [notizen, setNotizen] = useState(() => sortieren(initialNotizen));
  const [suche, setSuche] = useState("");
  const [neuId, setNeuId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const fachVon = (id: string | null) => faecher.find((f) => f.id === id) ?? null;

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return notizen.filter(
      (n) =>
        (!fachFilter || n.fach_id === fachFilter) &&
        (!q || n.titel.toLowerCase().includes(q) || n.inhalt.toLowerCase().includes(q)),
    );
  }, [notizen, fachFilter, suche]);

  const auswahl = notizen.find((n) => n.id === auswahlId) ?? null;

  function oeffnen(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("id", id);
    else params.delete("id");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  function aktualisieren(id: string, teil: Partial<Notiz>) {
    setNotizen((liste) => sortieren(liste.map((n) => (n.id === id ? { ...n, ...teil } : n))));
  }

  function neu() {
    setFehler(null);
    startTransition(async () => {
      try {
        const notiz = await notizAnlegen(fachFilter);
        setNotizen((liste) => sortieren([notiz, ...liste]));
        setNeuId(notiz.id);
        setSuche("");
        oeffnen(notiz.id);
        track("notiz_angelegt", { mit_fach: Boolean(fachFilter), mitschrift: false });
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
    oeffnen(null);
    track("notiz_geloescht");
    notizLoeschen(n.id).catch((err) => {
      setNotizen((liste) => sortieren([n, ...liste]));
      setFehler("Löschen hat nicht geklappt.");
      fehlerMelden(err, { ort: "notiz_loeschen" });
    });
  }

  const vorlesungHinweis =
    laufendeVorlesung &&
    (laufendeVorlesung.vorhandeneNotizId
      ? `Mitschrift für ${laufendeVorlesung.fachName} öffnen`
      : `Mitschrift für ${laufendeVorlesung.fachName} anlegen?`);

  return (
    <>
      <HubKopf
        titel="Notizen"
        untertitel="Schnelle Mitschriften in der Vorlesung und beim Lernen."
        aktionen={
          <button type="button" className="btnp" onClick={neu} disabled={isPending}>
            + Neue Notiz
          </button>
        }
      />
      <FachFilterChips faecher={faecher} />
      {fehler && <p className="auth-error">{fehler}</p>}

      {vorlesungHinweis && laufendeVorlesung && (
        <button type="button" className="hub-vorschlag" onClick={() => mitschrift(laufendeVorlesung)} disabled={isPending}>
          <span aria-hidden>🎓</span> Gerade läuft {laufendeVorlesung.fachName}. <strong>{vorlesungHinweis}</strong>
        </button>
      )}

      {notizen.length === 0 ? (
        <LeererZustand
          icon="📝"
          text="Noch keine Notizen. Halte hier fest, was in der Vorlesung wichtig war."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={neu} disabled={isPending}>
              + Erste Notiz anlegen
            </button>
          }
        />
      ) : (
        <div className="hub-zweispaltig" data-ansicht={auswahl ? "inhalt" : "liste"}>
          <section className="card hub-liste" aria-label="Notizliste">
            <input
              type="search"
              className="field"
              placeholder="Notizen durchsuchen …"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            <ul className="notiz-liste">
              {sichtbar.length === 0 && <li className="empty-state hub-liste-leer">Keine passenden Notizen.</li>}
              {sichtbar.map((n) => {
                const fach = fachVon(n.fach_id);
                const vorschau = markdownAlsText(n.inhalt).slice(0, 60);
                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`notiz-zeile ${n.id === auswahlId ? "aktiv" : ""}`}
                      onClick={() => oeffnen(n.id)}
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

          <section className="card hub-inhalt" aria-label="Notiz">
            {auswahl ? (
              <NotizEditor
                key={auswahl.id}
                notiz={auswahl}
                faecher={faecher}
                kiVerfuegbar={kiVerfuegbar}
                autoFokusTitel={auswahl.id === neuId}
                onZurueck={() => oeffnen(null)}
                onLokal={(teil) => aktualisieren(auswahl.id, teil)}
                onAnpinnen={() => anpinnen(auswahl)}
                onLoeschen={() => loeschen(auswahl)}
                onNeueNotiz={(n) => {
                  setNotizen((liste) => sortieren([n, ...liste]));
                  oeffnen(n.id);
                }}
              />
            ) : (
              <p className="empty-state hub-inhalt-leer">Wähle links eine Notiz aus oder lege eine neue an.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function NotizEditor({
  notiz,
  faecher,
  kiVerfuegbar,
  autoFokusTitel,
  onZurueck,
  onLokal,
  onAnpinnen,
  onLoeschen,
  onNeueNotiz,
}: {
  notiz: Notiz;
  faecher: FachOption[];
  kiVerfuegbar: boolean;
  autoFokusTitel: boolean;
  onZurueck: () => void;
  onLokal: (teil: Partial<Notiz>) => void;
  onAnpinnen: () => void;
  onLoeschen: () => void;
  onNeueNotiz: (n: Notiz) => void;
}) {
  const [titel, setTitel] = useState(notiz.titel);
  const [kiDialog, setKiDialog] = useState<"karten" | "zusammenfassung" | "mindmap" | null>(null);
  // Nach "Zusammenfassung oben einfügen" den Editor mit dem neuen Inhalt neu aufbauen
  const [editorVersion, setEditorVersion] = useState(0);
  const { status, aendern, jetztSpeichern } = useAutoSpeichern<{ titel: string; inhalt: string }>(async (aenderung) => {
    const geaendertAm = await notizSpeichern(notiz.id, aenderung);
    onLokal({ geaendert_am: geaendertAm });
  });

  function fachAendern(fachId: string) {
    onLokal({ fach_id: fachId || null });
    track("notiz_fach_geaendert", { mit_fach: Boolean(fachId) });
    notizFachSetzen(notiz.id, fachId || null).catch((err) => {
      onLokal({ fach_id: notiz.fach_id });
      fehlerMelden(err, { ort: "notiz_fach" });
    });
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
        <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: onLoeschen, gefahr: true }]} />
      </div>

      {kiDialog === "karten" && (
        <KiKartenDialog
          notiz={{ id: notiz.id, titel: titel || notiz.titel, fach_id: notiz.fach_id }}
          faecher={faecher}
          vorher={jetztSpeichern}
          onSchliessen={() => setKiDialog(null)}
        />
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
      {kiDialog === "mindmap" && (
        <KiMindmapDialog notizId={notiz.id} fachId={notiz.fach_id} vorher={jetztSpeichern} onSchliessen={() => setKiDialog(null)} />
      )}

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

      <MarkdownEditor
        key={editorVersion}
        wert={notiz.inhalt}
        platzhalter="Losschreiben … (# Überschrift, - Liste, [ ] Checkbox)"
        label="Notiztext"
        werkzeugExtra={(editor) => (
          // KI-13: diktierter Text wird an der Cursorposition eingefügt
          <DiktatKnopf klasse="md-diktat" onText={(text) => editor.chain().focus().insertContent({ type: "text", text: `${text} ` }).run()} />
        )}
        onAendern={(inhalt) => {
          onLokal({ inhalt });
          aendern({ inhalt });
        }}
      />
    </div>
  );
}
