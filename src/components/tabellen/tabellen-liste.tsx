"use client";

import { tabelleAnlegen, tabelleLoeschen } from "@/app/(hubs)/tabellen/actions";
import { ObjektListe } from "@/components/hubs/objekt-liste";
import type { FachOption } from "@/lib/fach-option";

export const OHNE_TITEL_TABELLE = "Unbenannte Tabelle";

export function TabellenListe({
  tabellen,
  faecher,
}: {
  tabellen: { id: string; titel: string; fach_id: string | null; geaendert_am: string }[];
  faecher: FachOption[];
}) {
  return (
    <ObjektListe
      hub="Tabellen"
      untertitel="Kleine Rechnungen und Übersichten – mit Formeln wie =SUMME(A1:A10)."
      icon="📊"
      neuLabel="Neue Tabelle"
      leerText="Noch keine Tabellen. Rechne z. B. deinen Notenschnitt oder werte Messwerte aus."
      ohneTitel={OHNE_TITEL_TABELLE}
      basisPfad="/tabellen"
      eventName="tabelle"
      eintraege={tabellen}
      faecher={faecher}
      anlegen={tabelleAnlegen}
      loeschen={tabelleLoeschen}
    />
  );
}
