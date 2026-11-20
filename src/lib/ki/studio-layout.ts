export const STUDIO_BREITE = { schmal: 360, standard: 460, breit: 880 } as const;

// Platz für die Arbeitsfläche inklusive ihrer Ränder, zusätzlich zu den sichtbaren Spalten.
const ARBEITSFLAECHE = 456;

export function studioMaximalbreite(fenster: number, navigation: number): number {
  return Math.min(STUDIO_BREITE.breit, Math.floor(fenster - navigation - ARBEITSFLAECHE));
}

export function studioBreiteBegrenzen(breite: number, maximum: number): number {
  return Math.max(STUDIO_BREITE.schmal, Math.min(maximum, Math.round(breite)));
}

export function studioBreiteLesen(gespeichert: string | null, frueherGross: string | null): number {
  const breite = Number(gespeichert);
  if (breite >= STUDIO_BREITE.schmal && breite <= STUDIO_BREITE.breit) return Math.round(breite);
  return frueherGross === "1" ? STUDIO_BREITE.breit : STUDIO_BREITE.standard;
}
