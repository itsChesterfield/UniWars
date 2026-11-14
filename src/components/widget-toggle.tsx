"use client";

import { useState, useTransition } from "react";
import { setSichtbareWidgets } from "@/app/settings/actions";
import { track } from "@/lib/analytics";

export const ALLE_WIDGETS = [
  { key: "ki", label: "✨ Vorschläge für heute" },
  { key: "heute", label: "Termine" },
  { key: "aufgaben", label: "Aufgaben, Fristen & Noten" },
  { key: "fortschritt", label: "Fortschritt" },
  { key: "faecher", label: "Fächer" },
] as const;

/**
 * Später hinzugekommene Widgets sind auch für Nutzer sichtbar, die ihr Dashboard schon
 * angepasst haben; ausgeblendet werden sie über den Eintrag „<key>:aus“.
 */
const STANDARD_AN = new Set<string>(["ki"]);
const aus = (key: string) => `${key}:aus`;
const istMarker = (k: string) => k.endsWith(":aus");

export function istWidgetSichtbar(sichtbareWidgets: string[], key: string): boolean {
  if (STANDARD_AN.has(key)) return !sichtbareWidgets.includes(aus(key));
  const echte = sichtbareWidgets.filter((k) => !istMarker(k));
  return echte.length === 0 || echte.includes(key);
}

export function widgetUmschalten(sichtbar: string[], key: string): string[] {
  if (STANDARD_AN.has(key)) return sichtbar.includes(aus(key)) ? sichtbar.filter((k) => k !== aus(key)) : [...sichtbar, aus(key)];
  const marker = sichtbar.filter(istMarker);
  const echte = sichtbar.filter((k) => !istMarker(k));
  const basis = echte.length === 0 ? ALLE_WIDGETS.map((w) => w.key).filter((k) => !STANDARD_AN.has(k)) : echte;
  return [...(basis.includes(key) ? basis.filter((k) => k !== key) : [...basis, key]), ...marker];
}

export function WidgetToggle({ initialSichtbareWidgets, kiVerfuegbar = false }: { initialSichtbareWidgets: string[]; kiVerfuegbar?: boolean }) {
  const [sichtbar, setSichtbar] = useState(initialSichtbareWidgets);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function umschalten(key: string) {
    const neu = widgetUmschalten(sichtbar, key);
    setSichtbar(neu);
    track("widget_umgeschaltet", { widget: key, sichtbar: istWidgetSichtbar(neu, key) });
    startTransition(() => setSichtbareWidgets(neu));
  }

  return (
    <div className="widget-toggle">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btng">
        Dashboard anpassen
      </button>

      {open && (
        <div className="widget-toggle-dropdown">
          {ALLE_WIDGETS.filter((w) => kiVerfuegbar || w.key !== "ki").map((w) => (
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
