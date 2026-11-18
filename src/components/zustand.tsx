import type { ReactNode } from "react";
import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";

/**
 * Design B3, Zustände „Leer“ und „Fehler“ (DESIGN.md Abschnitt 8).
 * Leer: was hierher gehört und genau eine Aktion, die es füllt.
 * Fehler: was kaputt ist, was nicht betroffen ist, und eine Aktion.
 * `region` für einen Teil der Seite (der Rest bleibt benutzbar), sonst steht der Zustand für den ganzen Bereich.
 */
export function Zustand({
  art,
  icon = art === "fehler" ? "warnung" : undefined,
  titel,
  ebene = 2,
  region = false,
  aktion,
  detail,
  children,
}: {
  art: "leer" | "fehler";
  icon?: IconName;
  titel: string;
  ebene?: 1 | 2 | 3;
  region?: boolean;
  /** Genau eine Aktion: Knopf oder Link mit Klasse `knopf` */
  aktion?: ReactNode;
  /** Kleingedrucktes, z. B. die Fehler-ID */
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const Titel = `h${ebene}` as const;
  return (
    <section
      className={`zustand z-${art}${region ? " z-region" : ""}`}
      role={art === "fehler" ? "alert" : undefined}
    >
      {icon && <Icon name={icon} groesse={24} />}
      <Titel>{titel}</Titel>
      {children && <p>{children}</p>}
      {aktion && <div className="zustand-aktion">{aktion}</div>}
      {detail && <p className="zustand-detail">{detail}</p>}
    </section>
  );
}

/** Die Tabellen eines Bereichs fehlen noch in der Datenbank (Migration nicht eingespielt). */
export function Einrichtung({ bereich }: { bereich: string }) {
  return (
    <Zustand art="leer" icon="info" titel={`${bereich} wird gerade eingerichtet.`} ebene={1}>
      Die Datenbank für diesen Bereich ist noch nicht freigeschaltet. Sobald das Update eingespielt ist, kannst du hier loslegen.
    </Zustand>
  );
}
