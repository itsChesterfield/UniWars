"use client";

import { mindmapAnlegen, mindmapLoeschen } from "@/app/(hubs)/mindmap/actions";
import { ObjektListe, type ObjektEintrag } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

export function MindmapListe({ eintraege, faecher }: { eintraege: ObjektEintrag[]; faecher: FachOption[] }) {
  return (
    <ObjektListe
      hub="MindMap"
      untertitel="Themen visuell strukturieren – Tab für einen Unterpunkt, Enter für einen weiteren Punkt."
      icon="🧠"
      neuLabel="Neue MindMap"
      leerText="Noch keine MindMaps. Sammle die Themen deiner nächsten Klausur auf einen Blick."
      ohneTitel="Unbenannte MindMap"
      basisPfad="/mindmap"
      eventName="mindmap"
      eintraege={eintraege}
      faecher={faecher}
      anlegen={mindmapAnlegen}
      loeschen={mindmapLoeschen}
      nameAbfragen="Neue MindMap"
    />
  );
}
