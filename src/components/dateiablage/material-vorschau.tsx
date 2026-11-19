"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import { PdfVorschau } from "./pdf-vorschau";
import { Icon } from "@/components/nav-icon";
import { FolieAnsicht } from "@/components/praesentationen/folie-ansicht";
import { ElementZeichnen } from "@/components/whiteboard/element-zeichnen";
import { gesamtRahmen } from "@/lib/whiteboard/elemente";
import { vorschauLaden, type MaterialVorschau } from "@/app/(hubs)/dateiablage/vorschau-actions";

export function useGedruecktHalten(anzeigen: (id: string) => void) {
  const druck = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const ausgeloest = useRef(false);

  function abbrechen() {
    if (druck.current) window.clearTimeout(druck.current.timer);
    druck.current = null;
  }

  useEffect(() => () => {
    if (druck.current) window.clearTimeout(druck.current.timer);
  }, []);

  return (id: string) => ({
    onPointerDown(e: PointerEvent) {
      abbrechen();
      ausgeloest.current = false;
      if (e.button !== 0) return;
      const timer = window.setTimeout(() => {
        ausgeloest.current = true;
        anzeigen(id);
      }, 520);
      druck.current = { id: e.pointerId, x: e.clientX, y: e.clientY, timer };
    },
    onPointerMove(e: PointerEvent) {
      const start = druck.current;
      if (start?.id === e.pointerId && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9) abbrechen();
    },
    onPointerCancel: abbrechen,
    onPointerUp: abbrechen,
    onPointerLeave: abbrechen,
    onDragStart: abbrechen,
    onClickCapture(e: MouseEvent) {
      if (!ausgeloest.current || e.detail === 0) return;
      ausgeloest.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });
}

function Inhalt({ daten, titel }: { daten: MaterialVorschau; titel: string }) {
  switch (daten.art) {
    case "pdf":
      return <PdfVorschau url={daten.url} titel={titel} />;
    case "bild":
      return <Image src={daten.url} alt={titel} width={960} height={640} unoptimized />;
    case "audio":
      return <audio src={daten.url} controls />;
    case "folie":
      return <FolieAnsicht folie={daten.folie} design={daten.design} />;
    case "whiteboard": {
      const rand = gesamtRahmen(daten.elemente);
      if (!rand) return <p>Das Whiteboard ist leer.</p>;
      return (
        <svg className="dat-material-board" role="img" aria-label={titel}
          viewBox={`${rand.x1 - 12} ${rand.y1 - 12} ${rand.x2 - rand.x1 + 24} ${rand.y2 - rand.y1 + 24}`}>
          {daten.elemente.map((element) => <ElementZeichnen key={element.id} e={element} />)}
        </svg>
      );
    }
    case "tabelle":
      return daten.zeilen.some((zeile) => zeile.some(Boolean))
        ? <div className="dat-tabellen-vorschau">
            <table className="dat-tabelle" aria-label={titel}>
              <tbody>{daten.zeilen.map((zeile, i) => <tr key={i}>{zeile.map((zelle, j) => <td key={j}>{zelle}</td>)}</tr>)}</tbody>
            </table>
          </div>
        : <p>Die Tabelle ist leer.</p>;
    case "text":
      return daten.zeilen.some(Boolean) ? <ul>{daten.zeilen.filter(Boolean).map((text, i) => <li key={i}>{text}</li>)}</ul> : <p>Hier steht noch nichts.</p>;
  }
}

export function MaterialVorschauFenster({ id, art, titel, schliessen, oeffnen }: {
  id: string; art: string; titel: string; schliessen: () => void; oeffnen: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [daten, setDaten] = useState<MaterialVorschau | null | undefined>(undefined);

  useEffect(() => {
    const knopf = document.activeElement;
    dialog.current?.showModal();
    return () => { if (knopf instanceof HTMLElement) knopf.focus(); };
  }, []);

  useEffect(() => {
    let gueltig = true;
    vorschauLaden(art, id).then((antwort) => {
      if (gueltig) setDaten(antwort);
    }).catch(() => {
      if (gueltig) setDaten(null);
    });
    return () => { gueltig = false; };
  }, [art, id]);

  return (
    <dialog ref={dialog} className="dat-vorschau dat-material-vorschau" aria-label={`Vorschau für ${titel}`} onClose={schliessen}>
      <div className="dat-vorschau-kopf">
        <h2 className="dat-vorschau-titel">{titel}</h2>
        <button type="button" className="knopf leise klein nur-symbol" aria-label="Vorschau schließen" onClick={schliessen}>
          <Icon name="schliessen" groesse={16} />
        </button>
      </div>
      {daten === undefined ? <p role="status">Vorschau wird geladen</p> :
        daten === null ? <p>Für diese Unterlage ist keine Vorschau verfügbar.</p> : <Inhalt daten={daten} titel={titel} />}
      <button type="button" className="knopf neben klein" onClick={() => { schliessen(); oeffnen(); }}>Öffnen</button>
    </dialog>
  );
}
