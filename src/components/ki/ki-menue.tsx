"use client";

import { useEffect, useRef, useState } from "react";

export type KiMenuePunkt = {
  label: string;
  beschreibung?: string;
  /** Grund, warum der Punkt gerade nicht geht (dann deaktiviert, Grund als Tooltip) */
  gesperrt?: string | null;
  onClick: () => void;
};

/** KI-02: Ein "✨ KI"-Menü statt mehrerer Knöpfe nebeneinander. */
export function KiMenue({ punkte, verfuegbar, label = "KI" }: { punkte: KiMenuePunkt[]; verfuegbar: boolean; label?: string }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const schliessen = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", schliessen);
    document.addEventListener("keydown", schliessen);
    return () => {
      document.removeEventListener("mousedown", schliessen);
      document.removeEventListener("keydown", schliessen);
    };
  }, [offen]);

  return (
    <div className="drei-punkte ki-menue" ref={ref}>
      <button
        type="button"
        className="btng ki-knopf"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label={verfuegbar ? "KI-Funktionen" : "KI gerade nicht verfügbar"}
        title={verfuegbar ? "KI-Funktionen für diese Notiz" : "KI gerade nicht verfügbar"}
        disabled={!verfuegbar}
        onClick={(e) => {
          e.stopPropagation();
          setOffen((o) => !o);
        }}
      >
        ✨ <span className="ki-knopf-text">{verfuegbar ? label : "KI gerade nicht verfügbar"}</span>
      </button>
      {offen && (
        <div className="drei-punkte-menue ki-menue-liste" role="menu">
          {punkte.map((p) => (
            <button
              key={p.label}
              type="button"
              role="menuitem"
              disabled={Boolean(p.gesperrt)}
              title={p.gesperrt ?? p.beschreibung}
              onClick={(e) => {
                e.stopPropagation();
                setOffen(false);
                p.onClick();
              }}
            >
              <span className="ki-menue-label">{p.label}</span>
              {(p.gesperrt || p.beschreibung) && <span className="ki-menue-info">{p.gesperrt ?? p.beschreibung}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
