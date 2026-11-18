"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Hauptknopf der Anmeldeseiten. Während die Server Action läuft, sagt der Text, was passiert,
 * und eine Lichtspur läuft unten im Knopf (Licht nur, wenn etwas arbeitet). Doppeltes Absenden ist gesperrt.
 */
export function AnmeldeKnopf({ children, laedtText }: { children: ReactNode; laedtText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="knopf haupt anm-knopf"
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      {pending ? laedtText : children}
      {pending && (
        <span className="anm-spur" aria-hidden="true">
          <i />
        </span>
      )}
    </button>
  );
}
