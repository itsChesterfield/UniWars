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
