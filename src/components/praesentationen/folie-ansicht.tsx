"use client";

import { bildUrl } from "@/components/hubs/bild-auswahl";
import { punkte, type Design, type Folie } from "@/lib/praesentationen/folien";

type Modus = "vorschau" | "bearbeiten";

/**
 * Eine Folie im 16:9-Format. Schriftgrößen skalieren mit der Breite (Container-Query-Einheiten),
 * dadurch sieht dieselbe Folie als Miniatur, im Editor und im Vollbild gleich aus.
 */
export function FolieAnsicht({
  folie,
  design,
  modus = "vorschau",
  onAendern,
  onBildWaehlen,
}: {
  folie: Folie;
  design: Design;
  modus?: Modus;
  onAendern?: (teil: Partial<Folie>) => void;
  onBildWaehlen?: () => void;
}) {
  const bearbeiten = modus === "bearbeiten" && onAendern;

  const titelFeld = (klasse: string, platzhalter: string) =>
    bearbeiten ? (
      <textarea
        className={`folie-feld ${klasse}`}
        value={folie.titel}
        placeholder={platzhalter}
        rows={1}
        maxLength={300}
        aria-label="Folientitel"
        onChange={(e) => onAendern({ titel: e.target.value })}
      />
    ) : (
      <div className={klasse}>{folie.titel || <span className="folie-leer">{platzhalter}</span>}</div>
    );

  const textFeld = (feld: "text" | "text2", klasse: string, platzhalter: string, alsListe: boolean) => {
    const wert = folie[feld];
    if (bearbeiten) {
      return (
        <textarea
          className={`folie-feld ${klasse}`}
          value={wert}
          placeholder={platzhalter}
          maxLength={5000}
          aria-label={feld === "text2" ? "Rechte Spalte" : alsListe ? "Aufzählung" : "Text"}
          onChange={(e) => onAendern({ [feld]: e.target.value })}
        />
      );
    }
    const liste = punkte(wert);
    if (!liste.length) return <div className={klasse}><span className="folie-leer">{platzhalter}</span></div>;
    return alsListe ? (
      <ul className={klasse}>
        {liste.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    ) : (
      <div className={klasse}>{wert}</div>
    );
  };

  return (
    <div className="folie" data-design={design} data-layout={folie.layout}>
      {folie.layout === "TITEL" && (
        <div className="folie-titelfolie">
          {titelFeld("folie-grosstitel", "Titel der Präsentation")}
          <span className="folie-linie" aria-hidden />
          {bearbeiten ? (
            <textarea
              className="folie-feld folie-untertitel"
              value={folie.text}
              placeholder="Untertitel, z. B. Name · Seminar · Datum"
              rows={2}
              maxLength={5000}
              aria-label="Untertitel"
              onChange={(e) => onAendern({ text: e.target.value })}
            />
          ) : (
            <div className="folie-untertitel">{folie.text}</div>
          )}
        </div>
      )}

      {folie.layout !== "TITEL" && (
        <>
          {titelFeld("folie-ueberschrift", "Überschrift")}
          <div className="folie-inhalt">
            {folie.layout === "TEXT" && textFeld("text", "folie-punkte", "Ein Punkt pro Zeile …", true)}
            {folie.layout === "ZWEISPALTIG" && (
              <div className="folie-spalten">
                {textFeld("text", "folie-punkte", "Linke Spalte – ein Punkt pro Zeile", true)}
                {textFeld("text2", "folie-punkte", "Rechte Spalte – ein Punkt pro Zeile", true)}
              </div>
            )}
            {folie.layout === "BILD" &&
              (folie.bild ? (
                <div className="folie-bild">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Bild aus der Dateiablage */}
                  <img src={bildUrl(folie.bild)} alt="" />
                  {bearbeiten && onBildWaehlen && (
                    <button type="button" className="btng folie-bild-knopf" onClick={onBildWaehlen}>
                      Bild ändern
                    </button>
                  )}
                </div>
              ) : bearbeiten && onBildWaehlen ? (
                <button type="button" className="folie-bild-leer" onClick={onBildWaehlen}>
                  🖼 Bild aus der Dateiablage wählen oder hochladen
                </button>
              ) : (
                <div className="folie-bild-leer">🖼</div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
