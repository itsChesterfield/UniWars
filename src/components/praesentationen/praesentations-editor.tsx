"use client";

import { positionLesen, positionMerken } from "@/lib/dateiablage/fortsetzen";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { praesentationFachSetzen, praesentationLoeschen, praesentationSpeichern } from "@/app/(hubs)/praesentationen/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { Icon } from "@/components/nav-icon";
import { BildAuswahl } from "@/components/hubs/bild-auswahl";
import { FolieAnsicht } from "@/components/praesentationen/folie-ansicht";
import { useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import {
  DESIGNS,
  LAYOUTS,
  MAX_FOLIEN,
  duplizieren,
  neueFolie,
  verschieben,
  type Design,
  type Folie,
  type Layout,
} from "@/lib/praesentationen/folien";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { SpeicherStatusAnzeige } from "@/components/bewegung/speicher-status";

type Aenderung = { titel: string; design: Design; folien: Folie[] };

export function PraesentationsEditor({
  id,
  userId,
  startTitel,
  startFachId,
  startDesign,
  startFolien,
  faecher,
  istNeu,
}: {
  id: string;
  userId: string;
  startTitel: string;
  startFachId: string | null;
  startDesign: Design;
  startFolien: Folie[];
  faecher: FachOption[];
  istNeu: boolean;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(startTitel);
  const [fachId, setFachId] = useState(startFachId);
  const [design, setDesign] = useState(startDesign);
  const [folien, setFolien] = useState<Folie[]>(startFolien.length ? startFolien : [neueFolie("TITEL", startTitel)]);
  const [ausgewaehlt, setAktivId] = useState<string | null>(null);
  const [gemerkt, setGemerkt] = useState<string | null>(null);
  useEffect(() => {
    const position = positionLesen(userId, id);
    if (position?.art === "praesentation") {
      const timer = window.setTimeout(() => setGemerkt(position.folieId), 0);
      return () => window.clearTimeout(timer);
    }
  }, [userId, id]);
  const aktivId = ausgewaehlt ?? gemerkt ?? folien[0].id;
  useEffect(() => {
    if (ausgewaehlt) positionMerken(userId, id, { art: "praesentation", folieId: ausgewaehlt });
  }, [ausgewaehlt, userId, id]);
  const [kontext, setKontext] = useState<{ index: number; x: number; y: number } | null>(null);
  const [ziehen, setZiehen] = useState<number | null>(null);
  const [ziel, setZiel] = useState<number | null>(null);
  const [bildFuer, setBildFuer] = useState<string | null>(null);
  const [praesentieren, setPraesentieren] = useState<number | null>(null);
  const { status, aendern } = useAutoSpeichern<Aenderung>((a) => praesentationSpeichern(id, a));

  const aktivIndex = Math.max(0, folien.findIndex((f) => f.id === aktivId));
  const aktiv = folien[aktivIndex];

  const folienAendern = useCallback(
    (neu: Folie[]) => {
      setFolien(neu);
      aendern({ folien: neu });
    },
    [aendern],
  );

  function folieAendern(teil: Partial<Folie>) {
    folienAendern(folien.map((f) => (f.id === aktiv.id ? { ...f, ...teil } : f)));
  }

  // PRÄ-03: Folien verwalten
  function hinzufuegen(layout: Layout) {
    if (folien.length >= MAX_FOLIEN) return;
    const neu = neueFolie(layout);
    const liste = [...folien];
    liste.splice(aktivIndex + 1, 0, neu);
    folienAendern(liste);
    setAktivId(neu.id);
    track("folie_angelegt", { layout });
  }

  function folieDuplizieren(index: number) {
    setKontext(null);
    if (folien.length >= MAX_FOLIEN) return;
    const kopie = duplizieren(folien[index]);
    const liste = [...folien];
    liste.splice(index + 1, 0, kopie);
    folienAendern(liste);
    setAktivId(kopie.id);
  }

  function folieLoeschen(index: number) {
    setKontext(null);
    if (folien.length <= 1) {
      window.alert("Eine Präsentation braucht mindestens eine Folie.");
      return;
    }
    if (!window.confirm(`Folie ${index + 1} wirklich löschen?`)) return;
    const liste = folien.filter((_, i) => i !== index);
    folienAendern(liste);
    setAktivId(liste[Math.min(index, liste.length - 1)].id);
  }

  async function entfernen() {
    if (!window.confirm(`„${titel}“ wirklich löschen?`)) return;
    try {
      await praesentationLoeschen(id);
      track("praesentation_geloescht");
      router.push("/praesentationen");
    } catch (err) {
      fehlerMelden(err, { ort: "praesentation_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  useEffect(() => {
    if (!kontext) return;
    const zu = () => setKontext(null);
    window.addEventListener("click", zu);
    return () => window.removeEventListener("click", zu);
  }, [kontext]);

  return (
    <div className="prae-seite">
      <Link href="/praesentationen" className="knopf leise klein zurueck-link">
        <Icon name="pfeil-links" groesse={16} />
        Alle Präsentationen
      </Link>
      <div className="txt-kopf">
        <input
          className="txt-titel"
          value={titel}
          aria-label="Name der Präsentation"
          maxLength={200}
          autoFocus={istNeu}
          onFocus={(e) => {
            if (istNeu) e.target.select();
          }}
          onChange={(e) => {
            setTitel(e.target.value);
            aendern({ titel: e.target.value });
          }}
        />
        <div className="txt-kopf-aktionen">
          <SpeicherStatusAnzeige status={status} />
          <select
            className="txt-fach"
            aria-label="Fach"
            value={fachId ?? ""}
            onChange={(e) => {
              setFachId(e.target.value || null);
              praesentationFachSetzen(id, e.target.value || null).catch((err) => fehlerMelden(err, { ort: "praesentation_fach" }));
            }}
          >
            <option value="">Ohne Fach</option>
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {/* PRÄ-05 */}
          <select
            className="txt-fach"
            aria-label="Design"
            value={design}
            onChange={(e) => {
              const d = e.target.value as Design;
              setDesign(d);
              aendern({ design: d });
              track("praesentation_design", { design: d });
            }}
          >
            {DESIGNS.map((d) => (
              <option key={d.wert} value={d.wert}>
                Design: {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="knopf haupt klein"
            onClick={() => {
              setPraesentieren(0);
              track("praesentation_gestartet", { folien: folien.length });
            }}
          >
            <Icon name="abspielen" groesse={16} />
            Präsentieren
          </button>
          <DreiPunkteMenue
            label="Exportieren und mehr"
            punkte={[
              {
                label: "Als PDF exportieren (Drucken)",
                onClick: () => {
                  track("praesentation_exportiert", { format: "pdf" });
                  window.print();
                },
              },
              { label: "Löschen", onClick: () => void entfernen(), gefahr: true },
            ]}
          />
        </div>
      </div>

      <div className="prae-koerper">
        {/* PRÄ-03: Miniaturen, ziehen zum Sortieren, Rechtsklick für Menü */}
        <aside className="prae-miniaturen" aria-label="Folien">
          <ol>
            {folien.map((f, i) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => {
                  setZiehen(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => {
                  if (ziehen === null) return;
                  e.preventDefault();
                  setZiel(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (ziehen !== null) folienAendern(verschieben(folien, ziehen, i));
                  setZiehen(null);
                  setZiel(null);
                }}
                onDragEnd={() => {
                  setZiehen(null);
                  setZiel(null);
                }}
                className={`${f.id === aktiv.id ? "aktiv" : ""} ${ziel === i && ziehen !== i ? "ziel" : ""}`}
              >
                <span className="prae-nummer" aria-hidden>
                  {i + 1}
                </span>
                <button
                  type="button"
                  className="prae-miniatur"
                  aria-current={f.id === aktiv.id ? "true" : undefined}
                  onClick={() => setAktivId(f.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setAktivId(f.id);
                    setKontext({ index: i, x: e.clientX, y: e.clientY });
                  }}
                >
                  {/* Name aus Nummer und Titel, die Vorschau ist nur zum Ansehen (WCAG 2.5.3) */}
                  <span className="sr-only">
                    Folie {i + 1}
                    {f.titel ? `: ${f.titel}` : ""}
                  </span>
                  <span aria-hidden>
                    <FolieAnsicht folie={f} design={design} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="prae-neu">
            <DreiPunkteMenue
              label="Neue Folie"
              knopfText="Neue Folie"
              punkte={LAYOUTS.map((l) => ({ label: `${l.name}: ${l.beschreibung}`, onClick: () => hinzufuegen(l.wert) }))}
            />
          </div>
        </aside>

        {/* PRÄ-04: aktive Folie groß bearbeiten */}
        <section className="prae-buehne" aria-label={`Folie ${aktivIndex + 1} bearbeiten`}>
          <FolieAnsicht
            key={aktiv.id}
            folie={aktiv}
            design={design}
            modus="bearbeiten"
            onAendern={folieAendern}
            onBildWaehlen={() => setBildFuer(aktiv.id)}
          />
          <div className="prae-buehne-leiste">
            <label className="prae-layout">
              Layout
              <select
                className="txt-fach"
                value={aktiv.layout}
                onChange={(e) => folieAendern({ layout: e.target.value as Layout })}
              >
                {LAYOUTS.map((l) => (
                  <option key={l.wert} value={l.wert}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="prae-stand">
              Folie <span className="zahl">{aktivIndex + 1}</span> von <span className="zahl">{folien.length}</span>
            </span>
            <button type="button" className="knopf leise klein" onClick={() => folieDuplizieren(aktivIndex)}>
              <Icon name="kopieren" groesse={16} />
              Duplizieren
            </button>
            <button type="button" className="knopf gefahr klein" onClick={() => folieLoeschen(aktivIndex)} disabled={folien.length <= 1}>
              <Icon name="loeschen" groesse={16} />
              Löschen
            </button>
          </div>
        </section>
      </div>

      {kontext && (
        <div className="drei-punkte-menue tab-kontext" style={{ left: kontext.x, top: kontext.y }} role="menu" onClick={(e) => e.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => folieDuplizieren(kontext.index)}>
            Duplizieren
          </button>
          <button type="button" role="menuitem" className="gefahr" onClick={() => folieLoeschen(kontext.index)}>
            Löschen
          </button>
        </div>
      )}

      {bildFuer && (
        <BildAuswahl
          fachId={fachId}
          onSchliessen={() => setBildFuer(null)}
          onWahl={(b) => {
            folienAendern(folien.map((f) => (f.id === bildFuer ? { ...f, bild: b.id } : f)));
            setBildFuer(null);
          }}
        />
      )}

      {praesentieren !== null && (
        <Vollbild folien={folien} design={design} start={praesentieren} onEnde={(letzte) => {
          setPraesentieren(null);
          setAktivId(folien[letzte]?.id ?? aktiv.id);
        }} />
      )}

      {/* PRÄ-07: nur für den Druck/PDF-Export sichtbar */}
      <div className="prae-druck" aria-hidden>
        {folien.map((f) => (
          <div key={f.id} className="prae-druck-folie">
            <FolieAnsicht folie={f} design={design} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** PRÄ-06: Vollbild, Pfeiltasten/Klick = weiter, Esc = beenden. */
function Vollbild({ folien, design, start, onEnde }: { folien: Folie[]; design: Design; start: number; onEnde: (letzte: number) => void }) {
  const [index, setIndex] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const indexRef = useRef(start);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const beenden = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onEnde(indexRef.current);
  }, [onEnde]);

  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => undefined);
    el?.focus();
    const weg = () => {
      if (!document.fullscreenElement) onEnde(indexRef.current);
    };
    document.addEventListener("fullscreenchange", weg);
    return () => document.removeEventListener("fullscreenchange", weg);
  }, [onEnde]);

  function taste(e: React.KeyboardEvent) {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
      e.preventDefault();
      setIndex((i) => Math.min(folien.length - 1, i + 1));
    } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      beenden();
    } else if (e.key === "Home") setIndex(0);
    else if (e.key === "End") setIndex(folien.length - 1);
  }

  return (
    <div
      ref={ref}
      className="prae-vollbild"
      data-theme="nacht"
      data-design={design}
      tabIndex={-1}
      role="dialog"
      aria-label="Präsentationsmodus"
      onKeyDown={taste}
      onClick={() => setIndex((i) => Math.min(folien.length - 1, i + 1))}
    >
      <div className="prae-vollbild-folie">
        <FolieAnsicht folie={folien[index]} design={design} />
      </div>
      <div className="prae-vollbild-info" onClick={(e) => e.stopPropagation()}>
        <span>
          {index + 1} von {folien.length}
        </span>
        <button type="button" className="knopf leise klein" onClick={beenden}>
          Beenden (Esc)
        </button>
      </div>
    </div>
  );
}
