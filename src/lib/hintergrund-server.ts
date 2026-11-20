import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { BUCKET, POSITION, benutzteBilder, bildFuer, hintergrundLesen, schleier, type Bild, type Groesse, type Hintergrund } from "@/lib/hintergrund";
import { ALLE_BEREICHE } from "@/lib/personalisierung";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Was die Oberfläche für ein Bild braucht: signierte Links, Ausschnitt, Schleier je Design. */
export type BildAnzeige = { gross: string; mittel: string; weich: string; pos: string; aN: number; aH: number; unscharf: boolean };

/** Fertig für den Rahmen der App (DesignRahmen): welche Fläche welches Bild zeigt. */
export type BilderAnsicht = {
  bilder: Record<string, BildAnzeige>;
  leiste: string | null;
  studio: string | null;
  /** Wahl für alle Bereiche und Abweichungen einzelner Bereiche */
  bereiche: string | null;
  bereich: Record<string, string | null>;
  groesse: Groesse;
  lernenAus: boolean;
};

/** Signierte Links gelten einen halben Tag; der Rahmen wird bei jedem vollen Laden neu erzeugt. */
const GUELTIG = 12 * 60 * 60;

/** Ob die Migration `eigene_bilder` eingespielt ist: Ohne Spalte gibt es den Abschnitt nicht. */
export const bilderVerfuegbar = (settings: unknown) => Boolean(settings && typeof settings === "object" && "hintergrund" in settings);

export async function signieren(supabase: Supabase, bilder: Bild[]): Promise<Record<string, BildAnzeige>> {
  if (!bilder.length) return {};
  const pfade = bilder.flatMap((b) => [b.pfad, b.mittel, b.weich]);
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pfade, GUELTIG);
  const url = new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
  const aus: Record<string, BildAnzeige> = {};
  for (const b of bilder) {
    const [gross, mittel, weich] = [url.get(b.pfad), url.get(b.mittel), url.get(b.weich)];
    if (!gross || !mittel || !weich) continue;
    aus[b.id] = { gross, mittel, weich, pos: POSITION[b.mitte], aN: schleier(b, "DUNKEL"), aH: schleier(b, "HELL"), unscharf: b.unschaerfe };
  }
  return aus;
}

/** Für das Layout: nur die Bilder, die gerade irgendwo zu sehen sind. `null`, wenn nichts zu zeigen ist. */
export async function bilderAnsicht(supabase: Supabase, settings: unknown, userId: string): Promise<BilderAnsicht | null> {
  if (!bilderVerfuegbar(settings)) return null;
  const h: Hintergrund = hintergrundLesen((settings as { hintergrund: unknown }).hintergrund, userId);
  const benutzt = benutzteBilder(h);
  if (!benutzt.length) return null;
  const bilder = await signieren(supabase, benutzt);
  const id = (b: Bild | null) => (b && bilder[b.id] ? b.id : null);
  const bereich: Record<string, string | null> = {};
  for (const k of ALLE_BEREICHE) if (h.bereich[k]) bereich[k] = id(bildFuer(h, "bereiche", k));
  return {
    bilder,
    leiste: id(bildFuer(h, "leiste")),
    studio: id(bildFuer(h, "studio")),
    bereiche: id(bildFuer(h, "bereiche")),
    bereich,
    groesse: h.groesse,
    lernenAus: h.lernen_aus,
  };
}
