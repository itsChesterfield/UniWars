"use client";

import { useEffect, useRef, useState } from "react";
import { bilderLaden } from "@/app/(hubs)/textverarbeitung/actions";
import { uploadAbschliessen, uploadVorbereiten } from "@/app/(hubs)/dateiablage/actions";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";
import { dateiTyp } from "@/lib/dateiablage/dateien";
import { fehlerMelden } from "@/lib/analytics";

export function bildUrl(dateiId: string) {
  return `/dateiablage/oeffnen/${dateiId}`;
}

/** Bild aus der Dateiablage wählen oder neu hochladen (landet dann in der Dateiablage). */
export function BildAuswahl({
  fachId,
  onWahl,
  onSchliessen,
}: {
  fachId: string | null;
  onWahl: (datei: { id: string; name: string }) => void;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  const [bilder, setBilder] = useState<{ id: string; name: string }[] | null>(null);
  const [fortschritt, setFortschritt] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    bilderLaden()
      .then(setBilder)
      .catch(() => setBilder([]));
  }, []);

  async function hochladen(datei: File) {
    if (dateiTyp(datei.name)?.art !== "bild") {
      setFehler("Bitte ein JPG- oder PNG-Bild wählen.");
      return;
    }
    setFehler(null);
    setFortschritt(0);
    try {
      const ticket = await uploadVorbereiten({ name: datei.name, groesse: datei.size, fachId });
      await hochladenMitFortschritt(ticket.signedUrl, datei, ticket.mime, setFortschritt);
      const neu = await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
      onWahl({ id: neu.id, name: neu.name });
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Hochladen hat nicht geklappt.");
      setFortschritt(null);
      fehlerMelden(err, { ort: "bild_hochladen" });
    }
  }

  return (
    <dialog
      ref={ref}
      className="card bild-auswahl"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
    >
      <div className="rowb">
        <h3 className="ct">Bild einfügen</h3>
        <button type="button" className="icon-knopf" aria-label="Schließen" onClick={onSchliessen}>
          ✕
        </button>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btnp" onClick={() => eingabe.current?.click()} disabled={fortschritt !== null}>
          ⤒ Neues Bild hochladen
        </button>
        <input
          ref={eingabe}
          type="file"
          accept=".png,.jpg,.jpeg"
          hidden
          onChange={(e) => {
            const datei = e.target.files?.[0];
            e.target.value = "";
            if (datei) void hochladen(datei);
          }}
        />
        {fortschritt !== null && (
          <div className="progress-track" style={{ flex: 1, minWidth: 120 }}>
            <div className="progress-fill" style={{ width: `${Math.round(fortschritt * 100)}%` }} />
          </div>
        )}
      </div>
      {fehler && <p className="auth-error">{fehler}</p>}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Oder aus der Dateiablage:
      </p>
      {bilder === null ? (
        <p className="empty-state">Lädt …</p>
      ) : bilder.length === 0 ? (
        <p className="empty-state">Noch keine Bilder in der Dateiablage.</p>
      ) : (
        <ul className="bild-raster">
          {bilder.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onWahl(b)} title={b.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Bild aus privatem Storage über Weiterleitung */}
                <img src={bildUrl(b.id)} alt={b.name} loading="lazy" />
                <span>{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
