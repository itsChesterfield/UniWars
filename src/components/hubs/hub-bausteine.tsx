import type { ReactNode } from "react";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";

/** Seitenkopf der Bereiche, siehe `Bereichskopf` (Zahl, Lage-Satz, Aktionen wie im Hub). */
export function HubKopf(props: Parameters<typeof Bereichskopf>[0]) {
  return <Bereichskopf {...props} />;
}

/** ALL-07: Hinweistext + großer Button für den ersten Eintrag. */
export function LeererZustand({ icon, text, aktion }: { icon: IconName; text: string; aktion?: ReactNode }) {
  return (
    <div className="hub-leer">
      <div className="hub-leer-icon" aria-hidden>
        <Icon name={icon} groesse={28} />
      </div>
      <p>{text}</p>
      {aktion}
    </div>
  );
}

/** Die Tabellen des Hubs fehlen noch in der Datenbank (Migration nicht eingespielt). */
export function EinrichtungHinweis({ hub }: { hub: string }) {
  return (
    <div className="card hub-einrichtung">
      <h2 className="ct">{hub} wird gerade eingerichtet</h2>
      <p className="muted">
        Die Datenbank für diesen Bereich ist noch nicht freigeschaltet. Sobald das Update eingespielt ist, kannst du hier
        loslegen.
      </p>
    </div>
  );
}
