import type { ReactNode } from "react";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { EinstellungenKontext } from "@/components/einstellungen/einstellungen-kontext";

/** Am Handy und in schmalen Fenstern steht die Kontextspalte der Einstellungen über dem Inhalt. */
export default function EinstellungenLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EinstellungenKontext mobil kiVerfuegbar={kiKonfiguriert()} />
      {children}
    </>
  );
}
