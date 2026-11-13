"use client";

import { whiteboardAnlegen, whiteboardLoeschen } from "@/app/(hubs)/whiteboard/actions";
import { ObjektListe, type ObjektEintrag } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

export function WhiteboardListe({ eintraege, faecher }: { eintraege: ObjektEintrag[]; faecher: FachOption[] }) {
  return (
    <ObjektListe
      hub="Whiteboard"
      untertitel="Frei skizzieren – Rechenwege, Diagramme, Ideen."
      icon="✏️"
      neuLabel="Neues Whiteboard"
      leerText="Noch keine Whiteboards. Skizziere hier Rechenwege oder Diagramme."
      ohneTitel="Unbenanntes Whiteboard"
      basisPfad="/whiteboard"
      eventName="whiteboard"
      eintraege={eintraege}
      faecher={faecher}
      anlegen={whiteboardAnlegen}
      loeschen={whiteboardLoeschen}
      nameAbfragen="Neues Whiteboard"
    />
  );
}
