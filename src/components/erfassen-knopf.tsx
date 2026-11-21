"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/nav-icon";
import { SCHNELL_ERFASSEN, type QuickAddModus } from "@/components/quick-add";

/** Aktion eines Leerzustands: öffnet „Schnell erfassen“ gleich mit dem passenden Typ. */
export function ErfassenKnopf({ modus, children }: { modus: QuickAddModus; children: ReactNode }) {
  return (
    <button
      type="button"
      className="knopf neben klein"
      onClick={() => window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { modus, quelle: "leerzustand" } }))}
    >
      <Icon name="plus" groesse={16} />
      {children}
    </button>
  );
}

/**
 * Hauptknopf eines Bereichs im Hub, passend zur Seite („Termin“, „Aufgabe“, „Note“) statt überall
 * „Schnell erfassen“ (Aufgabe 4, A4). Schnell erfassen bleibt über Q, die Suche und das Plus am Handy.
 */
export function HauptErfassenKnopf({ modus, children }: { modus?: QuickAddModus; children: ReactNode }) {
  return (
    <button
      type="button"
      className="knopf haupt"
      onClick={() => window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { ...(modus ? { modus } : {}), quelle: "bereich" } }))}
    >
      <Icon name="plus" groesse={16} />
      {children}
    </button>
  );
}

/** Öffnet im Bereich Fächer das Formular für ein neues Fach (mit Farbe und ECTS). */
export const FACH_NEU = "universe-fach-neu";
export function FachNeuKnopf() {
  return (
    <button type="button" className="knopf haupt" onClick={() => window.dispatchEvent(new CustomEvent(FACH_NEU))}>
      <Icon name="plus" groesse={16} />
      Fach
    </button>
  );
}
