"use client";

import { useEffect, useRef, useState } from "react";

export type MenuePunkt = { label: string; onClick: () => void; gefahr?: boolean };

export function DreiPunkteMenue({ punkte, label = "Weitere Aktionen" }: { punkte: MenuePunkt[]; label?: string }) {
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
    <div className="drei-punkte" ref={ref}>
      <button
        type="button"
        className="icon-knopf"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={offen}
        onClick={(e) => {
          e.stopPropagation();
          setOffen((o) => !o);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {offen && (
        <div className="drei-punkte-menue" role="menu">
          {punkte.map((p) => (
            <button
              key={p.label}
              type="button"
              role="menuitem"
              className={p.gefahr ? "gefahr" : ""}
              onClick={(e) => {
                e.stopPropagation();
                setOffen(false);
                p.onClick();
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
