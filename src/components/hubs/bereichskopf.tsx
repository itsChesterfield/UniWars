import type { ReactNode } from "react";
import { SteigText } from "@/components/bewegung/steig-text";

export type Lage = {
  /** Ein Satz, was in diesem Bereich gerade zählt, z. B. „Heute dran: Testgütekriterien.“ */
  text: string;
  /** Wörter aus `text`, die in der Akzentfarbe stehen (wie im Hub) */
  betont?: string[];
};

/**
 * Kopf aller Bereiche in der Sprache des Hubs: eine große Zahl mit Beschriftung,
 * daneben ein Satz, was hier gerade zählt. Ohne Zahl steht der Titel groß.
 * Eine Zahl nur, wenn sie etwas aussagt (fällig, offen, Minuten), nicht als bloße Anzahl.
 * Die Überschrift (h1) bleibt immer der Name des Bereichs.
 */
export function Bereichskopf({
  titel,
  untertitel,
  zahl,
  einheit,
  lage,
  aktionen,
}: {
  titel: string;
  untertitel?: string;
  /** Große Zahl links, z. B. fällige Karten oder Anzahl Notizen */
  zahl?: number | string | null;
  /** Beschriftung unter dem Titel neben der Zahl, z. B. „fällig heute“ */
  einheit?: string;
  lage?: Lage | null;
  aktionen?: ReactNode;
}) {
  const mitZahl = zahl !== undefined && zahl !== null;
  return (
    <header className={`bk${mitZahl ? " bk-mit-zahl" : ""}`}>
      {mitZahl ? (
        <div className="bk-zahl-block">
          <p className="bk-zahl" aria-hidden="true">
            <SteigText text={String(zahl)} schritt={60} />
          </p>
          <div className="bk-name">
            {/* Der Name steht schon in der Kopfleiste: hier nur für Screenreader (Aufgabe 4, A1) */}
            <h1 className={einheit ? "vh" : undefined}>{titel}</h1>
            {einheit && (
              <span>
                <span className="sr-only">{String(zahl)} </span>
                {einheit}
              </span>
            )}
          </div>
        </div>
      ) : (
        <h1 className="bk-titel">
          <SteigText text={titel} schritt={22} />
        </h1>
      )}
      <div className="bk-text">
        {lage && (
          <p className="bk-lage">
            <SteigText text={lage.text} start={mitZahl ? 220 : 160} schritt={12} akzent={lage.betont} />
          </p>
        )}
        {/* Der erklärende Satz nur, solange der Bereich noch nichts zu sagen hat (Aufgabe 4, A2) */}
        {untertitel && !lage && !mitZahl && <p className="bk-unter">{untertitel}</p>}
      </div>
      {aktionen && <div className="bk-aktionen">{aktionen}</div>}
    </header>
  );
}

/** Kurzer Titel für den Lage-Satz: lange Namen werden gekürzt, damit der Satz eine Zeile bleibt. */
export function kurzTitel(titel: string, max = 42): string {
  const t = titel.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
