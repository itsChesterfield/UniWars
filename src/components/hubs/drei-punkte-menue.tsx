"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/nav-icon";

export type MenuePunkt = { label: string; onClick: () => void; gefahr?: boolean };

/**
 * Design B3: Symbolknopf „Mehr“ mit Menü. Das Menü ist ein modaler Dialog am Knopf:
 * Klick daneben oder Escape schließt, der Rest der Seite ist solange nicht bedienbar (auch nicht halb verdeckt).
 */
export function DreiPunkteMenue({ punkte, label = "Weitere Aktionen" }: { punkte: MenuePunkt[]; label?: string }) {
  const [offen, setOffen] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    const k = knopf.current;
    if (!offen || !d || !k) return;
    d.showModal();
    // am Knopf ausrichten, rechtsbündig; reicht der Platz unten nicht, nach oben öffnen
    const r = k.getBoundingClientRect();
    d.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    if (window.innerHeight - r.bottom < d.offsetHeight + 16) {
      d.style.top = "";
      d.style.bottom = `${window.innerHeight - r.top + 4}px`;
    } else {
      d.style.bottom = "";
      d.style.top = `${r.bottom + 4}px`;
    }
    d.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [offen]);

  function schliessen() {
    dialog.current?.close();
    setOffen(false);
    knopf.current?.focus();
  }

  function tasten(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const liste = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = liste.indexOf(document.activeElement as HTMLButtonElement);
    const n = e.key === "Home" ? 0 : e.key === "End" ? liste.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + liste.length) % liste.length;
    liste[n]?.focus();
  }

  return (
    <span className="drei-punkte">
      <button
        ref={knopf}
        type="button"
        className="knopf leise klein nur-symbol"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={offen}
        onClick={(e) => {
          e.stopPropagation();
          setOffen(true);
        }}
      >
        <Icon name="mehr" groesse={18} />
      </button>
      {offen && (
        <dialog
          ref={dialog}
          className="drei-punkte-menue"
          aria-label={label}
          onCancel={(e) => {
            e.preventDefault();
            schliessen();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === dialog.current) schliessen();
          }}
        >
          <div role="menu" aria-label={label} onKeyDown={tasten}>
            {punkte.map((p) => (
              <button
                key={p.label}
                type="button"
                role="menuitem"
                className={p.gefahr ? "gefahr" : undefined}
                onClick={() => {
                  schliessen();
                  p.onClick();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </dialog>
      )}
    </span>
  );
}
