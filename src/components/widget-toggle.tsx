"use client";

import { useState, useTransition } from "react";
import { setSichtbareWidgets } from "@/app/settings/actions";

export const ALLE_WIDGETS = [
  { key: "heute", label: "Termine" },
  { key: "aufgaben", label: "Aufgaben & Fristen" },
  { key: "noten", label: "Noten" },
  { key: "fortschritt", label: "Fortschritt" },
  { key: "faecher", label: "Fächer" },
] as const;

export function istWidgetSichtbar(sichtbareWidgets: string[], key: string): boolean {
  return sichtbareWidgets.length === 0 || sichtbareWidgets.includes(key);
}

export function WidgetToggle({ initialSichtbareWidgets }: { initialSichtbareWidgets: string[] }) {
  const [sichtbar, setSichtbar] = useState(initialSichtbareWidgets);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function umschalten(key: string) {
    const aktuellAlleSichtbar = sichtbar.length === 0;
    const basis = aktuellAlleSichtbar ? ALLE_WIDGETS.map((w) => w.key) : sichtbar;
    const neu = basis.includes(key) ? basis.filter((k) => k !== key) : [...basis, key];

    setSichtbar(neu);
    startTransition(() => setSichtbareWidgets(neu));
  }

  return (
    <div className="widget-toggle">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btng">
        Dashboard anpassen
      </button>

      {open && (
        <div className="widget-toggle-dropdown">
          {ALLE_WIDGETS.map((w) => (
            <label key={w.key} className="widget-toggle-item">
              <input
                type="checkbox"
                checked={istWidgetSichtbar(sichtbar, w.key)}
                onChange={() => umschalten(w.key)}
              />
              {w.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
