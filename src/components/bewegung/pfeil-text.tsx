import type { ReactNode } from "react";
import { Icon } from "@/components/nav-icon";

/**
 * Inhalt für Knöpfe und Links, die irgendwohin führen (wie bei Mistral): Beim Zeigen gleitet der Pfeil rechts hinaus,
 * der Text rückt nach, ein zweiter Pfeil kommt von links. Nur mit Maus; bei reduzierter Bewegung bleibt alles still.
 */
export function PfeilText({ children }: { children: ReactNode }) {
  return (
    <span className="pfeil-text">
      <span className="pfeil-vorn" aria-hidden>
        <Icon name="pfeil-rechts" groesse={16} />
      </span>
      <span className="pfeil-wort">{children}</span>
      <span className="pfeil-hinten" aria-hidden>
        <Icon name="pfeil-rechts" groesse={16} />
      </span>
    </span>
  );
}
