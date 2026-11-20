import { Suspense, type ReactNode } from "react";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { EinstellungenKontextMitTeam } from "@/components/einstellungen/team-update-zugang";

/** Am Handy und in schmalen Fenstern steht die Kontextspalte der Einstellungen über dem Inhalt. */
export default function EinstellungenLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}><EinstellungenKontextMitTeam mobil kiVerfuegbar={kiKonfiguriert()} /></Suspense>
      {children}
    </>
  );
}
