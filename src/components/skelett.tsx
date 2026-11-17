import type { ReactNode } from "react";
import type { SkelettForm } from "@/lib/skelett";

const zeilen = (n: number, klasse?: string) => Array.from({ length: n }, (_, i) => <i key={i} className={klasse} />);

const Kopf = () => (
  <div className="sk-gruppe">
    <i className="sk-titel" />
    <i className="sk-kurz" />
  </div>
);

const INHALT: Record<SkelettForm, () => ReactNode> = {
  kopf: () => (
    <>
      <Kopf />
      <i className="sk-knopf" />
      <div className="sk-reihe">{zeilen(3)}</div>
      <div className="sk-gruppe">{zeilen(5, "sk-zeile")}</div>
    </>
  ),
  tabelle: () => (
    <>
      <Kopf />
      <div className="sk-gruppe sk-tab">{zeilen(6)}</div>
    </>
  ),
  text: () => (
    <div className="sk-spalte">
      <i className="sk-kurz" />
      <i className="sk-titel" />
      <div className="sk-gruppe">{zeilen(6, "sk-zeile")}</div>
    </div>
  ),
  zwei: () => (
    <div className="sk-zwei">
      <i className="sk-rund" />
      <div className="sk-gruppe sk-tab">{zeilen(5)}</div>
    </div>
  ),
  blatt: () => (
    <>
      <i className="sk-kurz" />
      <i className="sk-blatt" />
    </>
  ),
  gespraech: () => (
    <div className="sk-spalte">
      <i className="sk-blase ich" />
      <i className="sk-blase" />
      <i className="sk-blase ich" />
      <i className="sk-blase lang" />
    </div>
  ),
  flaeche: () => (
    <>
      <Kopf />
      <i className="sk-blatt sk-breit" />
    </>
  ),
};

/**
 * Design B3, Zustand „Laden“ (DESIGN.md Abschnitte 7 und 8): Platzhalter in der Form des Bereichs.
 * Erscheint erst nach 300 ms (CSS), damit schnelle Wechsel nicht flackern. Die Klasse `lade-skelett`
 * schaltet Lichtspur und gedämpfte Fläche ab: eine Anzeige pro Ladevorgang.
 */
export function Skelett({ form }: { form: SkelettForm }) {
  return (
    <div className={`lade-skelett sk-${form}`} role="status" aria-label="Wird geladen" aria-busy="true">
      {INHALT[form]()}
    </div>
  );
}
