"use server";

import { revalidatePath } from "next/cache";
import { KiEingabe, KiKeineDaten } from "@/lib/ki/fehler";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";
import { fachZuordnen, fotoParsen, fotoPromptBauen, MAX_BILD_ZEICHEN, tagLesen, zeitLesen, type FotoEintrag } from "@/lib/ki/stundenplan-foto";
import { naechsteFarbe } from "@/lib/fach-farben";
import { kalenderAbgleichAnstossen } from "@/lib/kalender/anstossen";
import type { Tables } from "@/lib/supabase/types";

/** Abgelesener Eintrag plus Vorschlag, zu welchem vorhandenen Fach er gehört. */
export type FotoVorschlag = FotoEintrag & { fachId: string | null };

/**
 * Stundenplan aus einem Foto ablesen (KI mit Bildverständnis). Trägt noch nichts ein –
 * der Nutzer prüft erst die Vorschau.
 */
export async function stundenplanFotoLesen(bild: string): Promise<KiErgebnis<{ eintraege: FotoVorschlag[] }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    if (typeof bild !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(bild)) {
      throw new KiEingabe("Bitte ein Foto oder einen Screenshot (JPG, PNG) auswählen.");
    }
    if (bild.length > MAX_BILD_ZEICHEN) throw new KiEingabe("Das Bild ist zu groß.");

    const { data: faecher } = await supabase.from("fach").select("id, name").eq("aktiv", true);
    const liste = faecher ?? [];
    const prompt = fotoPromptBauen(liste.map((f) => f.name));
    const { ergebnis } = await textAnfrageAusfuehren({
      supabase,
      funktion: "stundenplan_foto",
      zweck: "bild",
      optionen: { ...prompt, bilder: [bild], json: true, maxTokens: 3000, temperatur: 0.1 },
      parsen: (antwort) => {
        const eintraege = fotoParsen(antwort.text);
        if (eintraege.length === 0) {
          throw new KiKeineDaten("Auf dem Bild habe ich keinen Stundenplan erkannt. Versuch ein schärferes Foto, möglichst gerade von oben.");
        }
        return eintraege;
      },
    });
    return { ok: true, daten: { eintraege: ergebnis.map((e) => ({ ...e, fachId: fachZuordnen(e.fach, liste)?.id ?? null })) } };
  } catch (err) {
    return alsFehler(err);
  }
}

export type FotoUebernahme = {
  /** vorhandenes Fach … */
  fachId: string | null;
  /** … oder dieses Fach neu anlegen */
  neuesFach: string | null;
  tag: string;
  start: string;
  ende: string;
  raum: string | null;
  dozent: string | null;
};

/** Bestätigte Einträge speichern; fehlende Fächer werden dabei angelegt. */
export async function stundenplanFotoUebernehmen(eintraege: FotoUebernahme[]): Promise<{ angelegt: number; neueFaecher: number; eintraege: Tables<"stundenplan_eintrag">[] }> {
  const { supabase, userId } = await kiNutzer();
  if (!Array.isArray(eintraege) || eintraege.length === 0) return { angelegt: 0, neueFaecher: 0, eintraege: [] };
  if (eintraege.length > 60) throw new Error("Zu viele Einträge.");

  const { data: vorhandene, error: fachFehler } = await supabase.from("fach").select("id, name, farbe");
  if (fachFehler) throw new Error(fachFehler.message);
  const faecher = [...(vorhandene ?? [])];
  const eigeneIds = new Set(faecher.map((f) => f.id));

  // Neue Fächer einmal pro Name anlegen (vorhandene gleichen Namens wiederverwenden)
  const neueIds = new Map<string, string>();
  let neueFaecher = 0;
  for (const e of eintraege) {
    const name = e.neuesFach?.replace(/\s+/g, " ").trim().slice(0, 120);
    if (e.fachId || !name) continue;
    const schluessel = name.toLowerCase();
    if (neueIds.has(schluessel)) continue;
    const vorhanden = faecher.find((f) => f.name.trim().toLowerCase() === schluessel);
    if (vorhanden) {
      neueIds.set(schluessel, vorhanden.id);
      continue;
    }
    const { data, error } = await supabase
      .from("fach")
      .insert({ user_id: userId, name, farbe: naechsteFarbe(faecher), anwesenheitspflicht: false })
      .select("id, name, farbe")
      .single();
    if (error) throw new Error(error.message);
    faecher.push(data);
    eigeneIds.add(data.id);
    neueIds.set(schluessel, data.id);
    neueFaecher++;
  }

  const zeilen = [];
  for (const e of eintraege) {
    const fachId = e.fachId && eigeneIds.has(e.fachId) ? e.fachId : neueIds.get(e.neuesFach?.replace(/\s+/g, " ").trim().toLowerCase() ?? "");
    const tag = tagLesen(e.tag);
    const start = zeitLesen(e.start);
    const ende = zeitLesen(e.ende);
    if (!fachId || !tag || !start || !ende || ende <= start) continue;
    zeilen.push({
      user_id: userId,
      fach_id: fachId,
      tag,
      start_zeit: start,
      end_zeit: ende,
      raum: e.raum?.trim().slice(0, 100) || null,
      dozent: e.dozent?.trim().slice(0, 100) || null,
    });
  }
  let gespeichert: Tables<"stundenplan_eintrag">[] = [];
  if (zeilen.length) {
    const { data, error } = await supabase.from("stundenplan_eintrag").insert(zeilen).select();
    if (error) throw new Error(error.message);
    gespeichert = data ?? [];
  }
  revalidatePath("/");
  revalidatePath("/termine");
  await kalenderAbgleichAnstossen(supabase);
  return { angelegt: gespeichert.length, neueFaecher, eintraege: gespeichert };
}
