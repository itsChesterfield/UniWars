"use client";

import { useState } from "react";
import { KiFolienDialog } from "@/components/praesentationen/ki-folien-dialog";
import { praesentationAnlegen, praesentationLoeschen } from "@/app/(hubs)/praesentationen/actions";
import { ObjektListe, type ObjektEintrag } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

export function PraesentationsListe({
  eintraege,
  faecher,
}: {
  eintraege: ObjektEintrag[];
  faecher: FachOption[];
  kiVerfuegbar: boolean;
}) {
  const [kiOffen, setKiOffen] = useState(false);
  return (
    <>
      <ObjektListe
        hub="Präsentationen"
        untertitel="Einfache Referatsfolien – präsentieren im Vollbild oder als PDF exportieren."
        icon="🖥️"
        neuLabel="Neue Präsentation"
        leerText="Noch keine Präsentationen. Bereite dein nächstes Referat vor."
        ohneTitel="Unbenannte Präsentation"
        basisPfad="/praesentationen"
        eventName="praesentation"
        eintraege={eintraege}
        faecher={faecher}
        anlegen={praesentationAnlegen}
        loeschen={praesentationLoeschen}
      />
      {kiOffen && <KiFolienDialog onSchliessen={() => setKiOffen(false)} />}
    </>
  );
}
