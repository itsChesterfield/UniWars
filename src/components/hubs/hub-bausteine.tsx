import type { ReactNode } from "react";
import { SteigText } from "@/components/bewegung/steig-text";
import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";

export function HubKopf({ titel, untertitel, aktionen }: { titel: string; untertitel?: string; aktionen?: ReactNode }) {
  return (
    <header className="hub-kopf">
      <div>
        <h1>
          <SteigText text={titel} schritt={22} />
        </h1>
        {untertitel && <p className="muted">{untertitel}</p>}
      </div>
      {aktionen && <div className="hub-kopf-aktionen">{aktionen}</div>}
    </header>
  );
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
