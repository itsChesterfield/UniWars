"use client";

import { praesentationAnlegen, praesentationLoeschen } from "@/app/(hubs)/praesentationen/actions";
import { ObjektListe, type ObjektEintrag } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

export function PraesentationsListe({ eintraege, faecher }: { eintraege: ObjektEintrag[]; faecher: FachOption[] }) {
  return (
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
  );
}
