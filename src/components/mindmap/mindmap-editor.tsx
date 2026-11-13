"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mindmapFachSetzen, mindmapLoeschen, mindmapSpeichern } from "@/app/(hubs)/mindmap/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { SPEICHER_TEXT, useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import * as mm from "@/lib/mindmap/knoten";
import { svgAlsPng, textBreite, useAnsicht, useImBrowser } from "@/lib/zeichnen/ansicht";
import { dateiname, dateiSpeichern } from "@/lib/textverarbeitung/docx-export";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

const SCHRIFT = "600 15px 'Public Sans', system-ui, sans-serif";
const SCHRIFT_WURZEL = "700 18px 'Public Sans', system-ui, sans-serif";

function masse(k: mm.Knoten) {
  const istWurzel = k.parent_id === null;
  const text = k.text || " ";
  const breite = Math.max(istWurzel ? 140 : 90, Math.min(360, textBreite(text, istWurzel ? SCHRIFT_WURZEL : SCHRIFT) + 32));
  return { b: breite, h: istWurzel ? 54 : 40 };
}

function grenzen(daten: mm.MindmapDaten) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const k of daten.knoten) {
    const { b, h } = masse(k);
    x1 = Math.min(x1, k.x - b / 2);
    y1 = Math.min(y1, k.y - h / 2);
    x2 = Math.max(x2, k.x + b / 2);
    y2 = Math.max(y2, k.y + h / 2);
  }
  return Number.isFinite(x1) ? { x1, y1, x2, y2 } : { x1: -100, y1: -50, x2: 100, y2: 50 };
}

/** Helle Schrift auf dunklen Farben, dunkle auf hellen. */
function textFarbe(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1c1811" : "#ffffff";
}

export function MindmapEditor({
  id,
  startName,
  startFachId,
  startDaten,
  faecher,
}: {
  id: string;
  startName: string;
  startFachId: string | null;
  startDaten: mm.MindmapDaten;
  faecher: FachOption[];
}) {
  const router = useRouter();
  const imBrowser = useImBrowser();
  const [name, setName] = useState(startName);
  const [fachId, setFachId] = useState(startFachId);
  const [daten, setDaten] = useState(startDaten);
  const [auswahl, setAuswahl] = useState<string | null>(mm.wurzel(startDaten)?.id ?? null);
  const [bearbeiten, setBearbeiten] = useState<{ id: string; text: string; neu: boolean } | null>(null);
  const [farbMenue, setFarbMenue] = useState<{ id: string; x: number; y: number } | null>(null);
  const ziehen = useRef<{ id: string; px: number; py: number; bewegt: boolean; start: mm.MindmapDaten } | null>(null);
  const inhalt = useRef<SVGGElement>(null);
  const { ansicht, setAnsicht, flaeche, panStart, panBewegen, panEnde, einpassen, zoomen } = useAnsicht();
  const { status, aendern } = useAutoSpeichern<{ name: string; daten: mm.MindmapDaten }>((a) => mindmapSpeichern(id, a));

  const datenAendern = useCallback(
    (neu: mm.MindmapDaten) => {
      setDaten(neu);
      aendern({ daten: neu });
    },
    [aendern],
  );

  const wurzelKnoten = mm.wurzel(daten);
  const zentrieren = useCallback(() => {
    if (!wurzelKnoten) return;
    const el = flaeche.current;
    if (!el) return;
    einpassen({ x1: wurzelKnoten.x - 200, y1: wurzelKnoten.y - 150, x2: wurzelKnoten.x + 200, y2: wurzelKnoten.y + 150 }, 1);
  }, [wurzelKnoten, einpassen, flaeche]);

  // Beim Öffnen: alles einpassen
  const eingepasst = useRef(false);
  useEffect(() => {
    if (eingepasst.current) return;
    eingepasst.current = true;
    einpassen(grenzen(daten), 1);
  }, [daten, einpassen]);

  /** Neuen Knoten ins Bild holen, falls er außerhalb der sichtbaren Fläche liegt. */
  function sichtbarMachen(k: mm.Knoten) {
    const el = flaeche.current;
    if (!el) return;
    const rand = 90;
    const sx = k.x * ansicht.zoom + ansicht.x;
    const sy = k.y * ansicht.zoom + ansicht.y;
    let dx = 0;
    let dy = 0;
    if (sx > el.clientWidth - rand - 110) dx = el.clientWidth - rand - 110 - sx;
    if (sx < rand + 110) dx = rand + 110 - sx;
    if (sy > el.clientHeight - rand) dy = el.clientHeight - rand - sy;
    if (sy < rand) dy = rand - sy;
    if (dx || dy) setAnsicht((a) => ({ ...a, x: a.x + dx, y: a.y + dy }));
  }

  // --- MM-02: Knoten anlegen ---------------------------------------------------
  function neuerKnoten(art: "kind" | "geschwister") {
    if (!auswahl) return;
    const ergebnis = art === "kind" ? mm.kindHinzufuegen(daten, auswahl) : mm.geschwisterHinzufuegen(daten, auswahl);
    if (!ergebnis) return;
    datenAendern(ergebnis.daten);
    sichtbarMachen(ergebnis.neu);
    setAuswahl(ergebnis.neu.id);
    setBearbeiten({ id: ergebnis.neu.id, text: "", neu: true });
    track("mindmap_knoten_angelegt", { art });
  }

  function bearbeitenBeenden(uebernehmen: boolean) {
    if (!bearbeiten) return;
    const { id: kid, text, neu } = bearbeiten;
    setBearbeiten(null);
    if (!uebernehmen || !text.trim()) {
      // Neuer, leerer Knoten wird wieder entfernt
      if (neu) {
        const ohne = mm.loeschen(daten, kid);
        if (ohne) {
          datenAendern(ohne);
          setAuswahl(daten.knoten.find((k) => k.id === kid)?.parent_id ?? null);
        }
      }
      flaeche.current?.focus();
      return;
    }
    datenAendern(mm.aendern(daten, kid, { text: text.trim().slice(0, 200) }));
    if (kid === wurzelKnoten?.id && text.trim() !== name) {
      setName(text.trim());
      aendern({ name: text.trim() });
    }
    flaeche.current?.focus();
  }

  // --- MM-05: Löschen ----------------------------------------------------------
  function loeschenKnoten(kid: string) {
    const k = daten.knoten.find((x) => x.id === kid);
    if (!k) return;
    if (k.parent_id === null) {
      window.alert("Der Startknoten kann nicht gelöscht werden.");
      return;
    }
    const anzahl = mm.nachkommen(daten, kid).size;
    if (anzahl > 3 && !window.confirm(`„${k.text || "Knoten"}“ mit ${anzahl} Unterknoten löschen?`)) return;
    const neu = mm.loeschen(daten, kid);
    if (!neu) return;
    datenAendern(neu);
    setAuswahl(k.parent_id);
    track("mindmap_knoten_geloescht", { unterknoten: anzahl });
  }

  function taste(e: React.KeyboardEvent) {
    if (bearbeiten || !auswahl) return;
    if (e.key === "Tab") {
      e.preventDefault();
      neuerKnoten("kind");
    } else if (e.key === "Enter") {
      e.preventDefault();
      neuerKnoten("geschwister");
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      loeschenKnoten(auswahl);
    } else if (e.key === "F2") {
      e.preventDefault();
      const k = daten.knoten.find((x) => x.id === auswahl);
      if (k) setBearbeiten({ id: k.id, text: k.text, neu: false });
    } else if (e.key === "Escape") {
      setAuswahl(null);
    }
  }

  // --- MM-04: Ziehen -------------------------------------------------------------
  function knotenRunter(e: React.PointerEvent, k: mm.Knoten) {
    if (e.button !== 0 || bearbeiten?.id === k.id) return;
    e.stopPropagation();
    setAuswahl(k.id);
    setFarbMenue(null);
    flaeche.current?.focus({ preventScroll: true });
    ziehen.current = { id: k.id, px: e.clientX, py: e.clientY, bewegt: false, start: daten };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function bewegen(e: React.PointerEvent) {
    const z = ziehen.current;
    if (z) {
      const dx = (e.clientX - z.px) / ansicht.zoom;
      const dy = (e.clientY - z.py) / ansicht.zoom;
      if (!z.bewegt && Math.hypot(dx, dy) < 3) return;
      z.bewegt = true;
      setDaten(mm.verschieben(z.start, z.id, dx, dy));
      return;
    }
    panBewegen(e);
  }

  function hoch() {
    const z = ziehen.current;
    ziehen.current = null;
    if (z?.bewegt) aendern({ daten });
    panEnde();
  }

  async function exportieren() {
    if (!inhalt.current) return;
    try {
      const blob = await svgAlsPng(inhalt.current, grenzen(daten));
      dateiSpeichern(blob, dateiname(name, "png"));
      track("mindmap_exportiert");
    } catch (err) {
      fehlerMelden(err, { ort: "mindmap_export" });
      window.alert("Export hat nicht geklappt.");
    }
  }

  async function entfernen() {
    if (!window.confirm(`MindMap „${name}“ wirklich löschen?`)) return;
    try {
      await mindmapLoeschen(id);
      track("mindmap_geloescht");
      router.push("/mindmap");
    } catch (err) {
      fehlerMelden(err, { ort: "mindmap_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  useEffect(() => {
    if (!farbMenue) return;
    const zu = () => setFarbMenue(null);
    window.addEventListener("click", zu);
    return () => window.removeEventListener("click", zu);
  }, [farbMenue]);

  const nachId = useMemo(() => new Map(daten.knoten.map((k) => [k.id, k])), [daten]);
  const ausgewaehlt = auswahl ? nachId.get(auswahl) : undefined;

  return (
    <div className="zf-seite">
      <div className="txt-kopf">
        <Link href="/mindmap" className="hub-zurueck-link">
          ← Alle MindMaps
        </Link>
        <div className="txt-kopf-zeile">
          <h1 className="zf-titel">{name}</h1>
          <div className="txt-kopf-aktionen">
            <span className={`speicher-status ${status}`} aria-live="polite">
              {SPEICHER_TEXT[status]}
            </span>
            <select
              className="field txt-fach"
              aria-label="Fach"
              value={fachId ?? ""}
              onChange={(e) => {
                setFachId(e.target.value || null);
                mindmapFachSetzen(id, e.target.value || null).catch((err) => fehlerMelden(err, { ort: "mindmap_fach" }));
              }}
            >
              <option value="">Ohne Fach</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button type="button" className="btng" onClick={() => void exportieren()}>
              Als PNG exportieren
            </button>
            <DreiPunkteMenue punkte={[{ label: "MindMap löschen", onClick: () => void entfernen(), gefahr: true }]} />
          </div>
        </div>
      </div>

      <div className="zf-leiste" role="toolbar" aria-label="MindMap-Werkzeuge">
        <button type="button" className="md-knopf" onClick={() => neuerKnoten("kind")} disabled={!auswahl} title="Unterpunkt (Tab)">
          + Unterpunkt <kbd>Tab</kbd>
        </button>
        <button type="button" className="md-knopf" onClick={() => neuerKnoten("geschwister")} disabled={!auswahl} title="Weiterer Punkt (Enter)">
          + Punkt <kbd>Enter</kbd>
        </button>
        <button
          type="button"
          className="md-knopf"
          disabled={!ausgewaehlt}
          onClick={() => ausgewaehlt && setBearbeiten({ id: ausgewaehlt.id, text: ausgewaehlt.text, neu: false })}
        >
          Umbenennen <kbd>F2</kbd>
        </button>
        <button
          type="button"
          className="md-knopf"
          disabled={!ausgewaehlt || ausgewaehlt.parent_id === null}
          onClick={() => ausgewaehlt && loeschenKnoten(ausgewaehlt.id)}
        >
          Löschen <kbd>Entf</kbd>
        </button>
        <span className="txt-trenner" />
        <span className="zf-farben" role="group" aria-label="Farbe des Knotens">
          {mm.KNOTEN_FARBEN.map((f) => (
            <button
              key={f.wert}
              type="button"
              className={`tab-farbe ${ausgewaehlt?.farbe === f.wert ? "an" : ""}`}
              style={{ background: f.wert }}
              title={f.name}
              aria-label={`Farbe ${f.name}`}
              disabled={!ausgewaehlt}
              onClick={() => ausgewaehlt && datenAendern(mm.aendern(daten, ausgewaehlt.id, { farbe: f.wert }))}
            />
          ))}
        </span>
        <span className="txt-trenner" />
        <button type="button" className="md-knopf" onClick={() => zoomen(1 / 1.2)} aria-label="Verkleinern">
          −
        </button>
        <span className="mono zf-zoom">{Math.round(ansicht.zoom * 100)} %</span>
        <button type="button" className="md-knopf" onClick={() => zoomen(1.2)} aria-label="Vergrößern">
          +
        </button>
        <button type="button" className="md-knopf" onClick={zentrieren}>
          ⌖ Zentrieren
        </button>
      </div>

      <div
        ref={flaeche}
        className="zf-flaeche"
        tabIndex={0}
        role="application"
        aria-label="MindMap-Zeichenfläche. Tab: Unterpunkt, Enter: weiterer Punkt, Entf: löschen, F2: umbenennen."
        onKeyDown={taste}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setAuswahl(null);
          setFarbMenue(null);
          panStart(e);
        }}
        onPointerMove={bewegen}
        onPointerUp={hoch}
        onPointerCancel={hoch}
      >
        <svg className="zf-svg" width="100%" height="100%">
          <g ref={inhalt} transform={`translate(${ansicht.x} ${ansicht.y}) scale(${ansicht.zoom})`}>
            {imBrowser && <>
            {/* Verbindungen */}
            {daten.knoten.map((k) => {
              const p = k.parent_id ? nachId.get(k.parent_id) : undefined;
              if (!p) return null;
              const mx = (p.x + k.x) / 2;
              return (
                <path
                  key={`l-${k.id}`}
                  d={`M ${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${k.y}, ${k.x} ${k.y}`}
                  fill="none"
                  stroke={k.farbe}
                  strokeWidth={2.5}
                  strokeOpacity={0.7}
                />
              );
            })}
            {/* Knoten */}
            {daten.knoten.map((k) => {
              const { b, h } = masse(k);
              const istWurzel = k.parent_id === null;
              const gewaehlt = k.id === auswahl;
              const wirdBearbeitet = bearbeiten?.id === k.id;
              return (
                <g
                  key={k.id}
                  transform={`translate(${k.x - b / 2} ${k.y - h / 2})`}
                  className="zf-knoten"
                  data-id={k.id}
                  onPointerDown={(e) => knotenRunter(e, k)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setBearbeiten({ id: k.id, text: k.text, neu: false });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAuswahl(k.id);
                    setFarbMenue({ id: k.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  {gewaehlt && (
                    <rect className="ui" x={-4} y={-4} width={b + 8} height={h + 8} rx={istWurzel ? 16 : 13} fill="none" stroke="#2a2318" strokeWidth={2} strokeDasharray="5 4" />
                  )}
                  <rect width={b} height={h} rx={istWurzel ? 12 : 10} fill={k.farbe} stroke={istWurzel ? "#2a2318" : "none"} strokeWidth={istWurzel ? 1.5 : 0} />
                  {wirdBearbeitet ? (
                    <foreignObject x={4} y={4} width={Math.max(b, 220) - 8} height={h - 8}>
                      <input
                        className="zf-knoten-eingabe"
                        autoFocus
                        value={bearbeiten.text}
                        maxLength={200}
                        placeholder="Text …"
                        aria-label="Text des Knotens"
                        onChange={(e) => setBearbeiten({ ...bearbeiten, text: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            bearbeitenBeenden(true);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            bearbeitenBeenden(false);
                          }
                        }}
                        onBlur={() => bearbeitenBeenden(true)}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={b / 2}
                      y={h / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={textFarbe(k.farbe)}
                      fontFamily="Public Sans, system-ui, sans-serif"
                      fontWeight={istWurzel ? 700 : 600}
                      fontSize={istWurzel ? 18 : 15}
                    >
                      {k.text.length > 40 ? `${k.text.slice(0, 39)}…` : k.text || "…"}
                    </text>
                  )}
                  {gewaehlt && !wirdBearbeitet && (
                    <g
                      className="ui zf-plus"
                      transform={`translate(${b + 14} ${h / 2})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        neuerKnoten("kind");
                      }}
                    >
                      <title>Unterpunkt hinzufügen</title>
                      <circle r={11} fill="#ffffff" stroke="#2a2318" strokeWidth={1.5} />
                      <path d="M -5 0 H 5 M 0 -5 V 5" stroke="#2a2318" strokeWidth={2} strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}
            </>}
          </g>
        </svg>
        <p className="zf-hilfe faint">Mausrad: Zoom · Fläche ziehen: verschieben · Doppelklick: Text · Rechtsklick: Farbe</p>
      </div>

      {farbMenue && (
        <div className="drei-punkte-menue tab-kontext zf-farbmenue" style={{ left: farbMenue.x, top: farbMenue.y }} role="menu" onClick={(e) => e.stopPropagation()}>
          <span className="faint dat-verschieben-titel">Farbe</span>
          <div className="zf-farben">
            {mm.KNOTEN_FARBEN.map((f) => (
              <button
                key={f.wert}
                type="button"
                role="menuitem"
                className="tab-farbe"
                style={{ background: f.wert }}
                aria-label={f.name}
                title={f.name}
                onClick={() => {
                  datenAendern(mm.aendern(daten, farbMenue.id, { farbe: f.wert }));
                  setFarbMenue(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
