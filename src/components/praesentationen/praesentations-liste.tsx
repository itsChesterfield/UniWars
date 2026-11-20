"use client";

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
  return (
    <>
      <ObjektListe
        hub="Präsentationen"
        einheit={["Präsentation", "Präsentationen"]}
        untertitel="Einfache Referatsfolien, präsentieren im Vollbild oder als PDF exportieren."
        icon="praesentation"
        neuLabel="Neue Präsentation"
        leerTitel="Noch keine Präsentationen."
        leerText="Bereite dein nächstes Referat vor."
        ohneTitel="Unbenannte Präsentation"
        basisPfad="/praesentationen"
        eventName="praesentation"
        eintraege={eintraege}
        faecher={faecher}
        anlegen={praesentationAnlegen}
        loeschen={praesentationLoeschen}
      />
    </>
  );
}
