"use client";

import { useEffect, useRef, useState } from "react";
import type { Markierung } from "@/app/(hubs)/pdf-reader/actions";
import { FARBEN, FARB_INFO, type Farbe } from "@/lib/pdf-reader/markierungen";
import { ZITAT_DRAG_TYP, zitatAlsText, type Zitat } from "@/lib/geteilte-ansicht";
import { Icon } from "@/components/nav-icon";

export type MenuePosition = { x: number; y: number; unten: boolean };

/** Fokus nicht wegnehmen – sonst geht die Textauswahl verloren. */
const auswahlBehalten = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

export function FarbPunkte({ aktiv, onWahl, klein }: { aktiv?: Farbe | null; onWahl: (f: Farbe) => void; klein?: boolean }) {
  return (
    <span className={`pdf-farben ${klein ? "klein" : ""}`} role="group" aria-label="Markerfarbe">
      {FARBEN.map((f) => (
        <button
          key={f}
          type="button"
          className={`pdf-farbpunkt ${aktiv === f ? "an" : ""}`}
          style={{ "--marker": FARB_INFO[f].wert } as React.CSSProperties}
          aria-label={FARB_INFO[f].name}
          aria-pressed={aktiv === f}
          title={FARB_INFO[f].name}
          onPointerDown={auswahlBehalten}
          onMouseDown={auswahlBehalten}
          onClick={() => onWahl(f)}
        />
      ))}
    </span>
  );
}

function stil(pos: MenuePosition): React.CSSProperties {
  const rand = 150;
  const x = typeof window === "undefined" ? pos.x : Math.min(Math.max(pos.x, rand), window.innerWidth - rand);
  return { left: x, top: pos.y };
}

/** Erscheint über markiertem Text: Farbe wählen = markieren. */
export function AuswahlMenue({ pos, onMarkieren, onKopieren }: { pos: MenuePosition; onMarkieren: (f: Farbe) => void; onKopieren: () => void }) {
  return (
    <div className={`pdf-markier-menue ${pos.unten ? "unten" : ""}`} style={stil(pos)} role="toolbar" aria-label="Auswahl markieren">
      <span className="pdf-menue-label" aria-hidden>
        <Icon name="markieren" groesse={16} />
      </span>
      <FarbPunkte onWahl={onMarkieren} />
      <button type="button" className="pdf-menue-knopf" onPointerDown={auswahlBehalten} onMouseDown={auswahlBehalten} onClick={onKopieren}>
        Kopieren
      </button>
    </div>
  );
}

/** Erscheint beim Klick auf eine bestehende Markierung. */
export function MarkierungMenue({
  markierung,
  pos,
  onFarbe,
  onNotiz,
  onLoeschen,
  onSchliessen,
}: {
  markierung: Markierung;
  pos: MenuePosition;
  onFarbe: (f: Farbe) => void;
  onNotiz: (notiz: string) => void;
  onLoeschen: () => void;
  onSchliessen: () => void;
}) {
  const [notizOffen, setNotizOffen] = useState(Boolean(markierung.notiz));
  const [notiz, setNotiz] = useState(markierung.notiz ?? "");
  const gespeichert = useRef((markierung.notiz ?? "").trim());
  const speichern = () => {
    if (notiz.trim() === gespeichert.current) return;
    gespeichert.current = notiz.trim();
    onNotiz(notiz);
  };
  // Menü wird durch Klick daneben geschlossen → Notiz trotzdem sichern
  const speichernRef = useRef(speichern);
  useEffect(() => {
    speichernRef.current = speichern;
  });
  useEffect(() => () => speichernRef.current(), []);

  return (
    <div
      className={`pdf-markier-menue gross ${pos.unten ? "unten" : ""}`}
      style={stil(pos)}
      role="dialog"
      aria-label="Markierung bearbeiten"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          speichern();
          onSchliessen();
        }
      }}
    >
      <div className="rowb">
        <FarbPunkte aktiv={markierung.farbe} onWahl={onFarbe} />
        <span className="pdf-menue-knoepfe">
          <button type="button" className={`pdf-menue-knopf ${notizOffen ? "an" : ""}`} onClick={() => setNotizOffen((o) => !o)} title="Notiz" aria-label="Notiz" aria-pressed={notizOffen}>
            <Icon name="notizen" groesse={16} />
          </button>
          <button
            type="button"
            className="pdf-menue-knopf"
            title="Text kopieren"
            aria-label="Text kopieren"
            onClick={() => void navigator.clipboard?.writeText(markierung.text).catch(() => undefined)}
          >
            <Icon name="kopieren" groesse={16} />
          </button>
          <button type="button" className="pdf-menue-knopf gefahr" title="Markierung löschen" aria-label="Markierung löschen" onClick={onLoeschen}>
            <Icon name="loeschen" groesse={16} />
          </button>
        </span>
      </div>
      {notizOffen && (
        <textarea
          className="field pdf-notiz"
          autoFocus={!markierung.notiz}
          rows={3}
          maxLength={2000}
          placeholder="Notiz zu dieser Stelle …"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          onBlur={speichern}
        />
      )}
    </div>
  );
}

export function MarkierungsListe({
  quelle,
  markierungen,
  seite,
  onSpringen,
  onLoeschen,
  onKopieren,
}: {
  /** Dateiname – kommt beim Ziehen in eine Notiz als Quellenangabe mit */
  quelle: string;
  markierungen: Markierung[];
  seite: number;
  onSpringen: (m: Markierung) => void;
  onLoeschen: (m: Markierung) => void;
  onKopieren: () => void;
}) {
  const [farbFilter, setFarbFilter] = useState<Farbe | null>(null);
  const sichtbar = markierungen.filter((m) => !farbFilter || m.farbe === farbFilter);

  if (markierungen.length === 0) {
    return <p className="pdf-leer">Noch keine Markierungen. Wähle Text im PDF aus und tippe auf eine Farbe, oder schalte oben den Textmarker ein.</p>;
  }

  return (
    <>
      <div className="pdf-liste-kopf">
        <FarbPunkte klein aktiv={farbFilter} onWahl={(f) => setFarbFilter((alt) => (alt === f ? null : f))} />
        <button type="button" className="pdf-menue-knopf" onClick={onKopieren} title="Alle Markierungen als Text kopieren">
          Alle kopieren
        </button>
      </div>
      <ul className="pdf-markier-liste">
        {sichtbar.map((m) => (
          <li
            key={m.id}
            style={{ "--marker": FARB_INFO[m.farbe].wert } as React.CSSProperties}
            draggable={Boolean(m.text.trim())}
            title={m.text.trim() ? "In eine Notiz ziehen, um die Stelle als Zitat einzufügen" : undefined}
            onDragStart={(e) => {
              // Geteilte Ansicht: Markierung in den Notizen-Hub ziehen
              const zitat: Zitat = { text: m.text, quelle, seite: m.seite, notiz: m.notiz };
              e.dataTransfer.setData(ZITAT_DRAG_TYP, JSON.stringify(zitat));
              e.dataTransfer.setData("text/plain", zitatAlsText(zitat));
              e.dataTransfer.effectAllowed = "copy";
            }}
          >
            <button type="button" className={m.seite === seite ? "aktiv" : ""} onClick={() => onSpringen(m)}>
              <span className="pdf-markier-seite">S. {m.seite}</span>
              <span className="pdf-markier-text">{m.text.trim() || "(ohne Text)"}</span>
              {m.notiz && (
                <span className="pdf-markier-notiz">
                  <Icon name="notizen" groesse={12} />
                  {m.notiz}
                </span>
              )}
            </button>
            <button type="button" className="pdf-markier-weg" aria-label="Markierung löschen" title="Löschen" onClick={() => onLoeschen(m)}>
              <Icon name="schliessen" groesse={14} />
            </button>
          </li>
        ))}
        {sichtbar.length === 0 && <li className="pdf-leer">Keine Markierungen in dieser Farbe.</li>}
      </ul>
    </>
  );
}
