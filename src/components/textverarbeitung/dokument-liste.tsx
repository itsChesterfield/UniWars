"use client";

import { dokumentAnlegen, dokumentLoeschen } from "@/app/(hubs)/textverarbeitung/actions";
import { ObjektListe } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

type Eintrag = { id: string; titel: string; fach_id: string | null; woerter: number; geaendert_am: string };

export const OHNE_TITEL = "Unbenanntes Dokument";

/** TXT-01: Übersicht aller Dokumente. */
export function DokumentListe({ dokumente, faecher }: { dokumente: Eintrag[]; faecher: FachOption[] }) {
  return (
    <ObjektListe
      hub="Textverarbeitung"
      untertitel="Hausarbeiten, Protokolle und andere lange Texte – mit Export als PDF oder Word."
      icon="📄"
      neuLabel="Neues Dokument"
      leerText="Noch keine Dokumente. Starte deine Hausarbeit oder dein nächstes Protokoll."
      ohneTitel={OHNE_TITEL}
      basisPfad="/textverarbeitung"
      eventName="dokument"
      eintraege={dokumente.map((d) => ({ ...d, info: `${d.woerter.toLocaleString("de-DE")} Wörter` }))}
      faecher={faecher}
      anlegen={dokumentAnlegen}
      loeschen={dokumentLoeschen}
    />
  );
}
