"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { BUCKET, MAX_BILDER, bildEntfernen, hintergrundLesen, type Bild, type Hintergrund } from "@/lib/hintergrund";

type Ergebnis = { ok: boolean; fehler?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function laden() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const { data, error } = await supabase.from("settings").select("hintergrund").eq("user_id", user.id).maybeSingle();
  if (error || !data) return { supabase, user, h: null };
  return { supabase, user, h: hintergrundLesen(data.hintergrund, user.id) };
}

async function schreiben(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, h: Hintergrund): Promise<boolean> {
  const { error } = await supabase
    .from("settings")
    .update({ hintergrund: h as unknown as Json })
    .eq("user_id", userId);
  if (error) return false;
  revalidatePath("/", "layout");
  return true;
}

/**
 * Zuordnung und Regler speichern. Die Liste der Bilder und ihre Pfade kommen immer aus der Datenbank,
 * vom Browser zählen nur Ausschnitt, Schleier und Unschärfe der vorhandenen Bilder.
 */
export async function hintergrundSpeichern(roh: unknown): Promise<Ergebnis> {
  const { supabase, user, h } = await laden();
  if (!h) return { ok: false };
  const neu = hintergrundLesen({ ...(roh as object), bilder: h.bilder.map((b) => ({ ...b, ...einstellungen(roh, b.id) })) }, user.id);
  return { ok: await schreiben(supabase, user.id, neu) };
}

function einstellungen(roh: unknown, id: string): Partial<Bild> {
  const liste = roh && typeof roh === "object" && Array.isArray((roh as { bilder?: unknown }).bilder) ? (roh as { bilder: unknown[] }).bilder : [];
  const b = liste.find((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && (x as { id?: unknown }).id === id);
  if (!b) return {};
  return { mitte: b.mitte as Bild["mitte"], abdunkeln: b.abdunkeln as Bild["abdunkeln"], unschaerfe: b.unschaerfe === true };
}

/**
 * Nach dem Hochladen der drei Fassungen (Browser, eigener Ordner im Bucket): Bild in die Liste aufnehmen.
 * Prüft, dass alle drei Dateien wirklich im Ordner des Nutzers liegen. Das erste Bild wird Standard.
 */
export async function bildAufnehmen(eingabe: { id: string; endung: "webp" | "jpg"; tief: number; hoch: number }): Promise<Ergebnis> {
  const { supabase, user, h } = await laden();
  if (!h) return { ok: false };
  if (!UUID.test(eingabe.id) || (eingabe.endung !== "webp" && eingabe.endung !== "jpg")) return { ok: false };
  if (h.bilder.length >= MAX_BILDER) return { ok: false, fehler: `Du hast schon ${MAX_BILDER} Bilder. Lösch eins, dann ist wieder Platz.` };

  const namen = [`${eingabe.id}.${eingabe.endung}`, `${eingabe.id}-m.${eingabe.endung}`, `${eingabe.id}-w.${eingabe.endung}`];
  const { data: liste } = await supabase.storage.from(BUCKET).list(user.id, { search: eingabe.id, limit: 10 });
  const da = new Set((liste ?? []).map((d) => d.name));
  if (!namen.every((n) => da.has(n))) return { ok: false };

  const [pfad, mittel, weich] = namen.map((n) => `${user.id}/${n}`);
  const bild = { id: eingabe.id, pfad, mittel, weich, tief: eingabe.tief, hoch: eingabe.hoch, mitte: "mitte", abdunkeln: 0, unschaerfe: false };
  const neu = hintergrundLesen({ ...h, bilder: [...h.bilder, bild], standard: h.standard ?? eingabe.id }, user.id);
  if (!neu.bilder.some((b) => b.id === eingabe.id)) return { ok: false };
  return { ok: await schreiben(supabase, user.id, neu) };
}

/** Bild endgültig löschen: aus allen Zuordnungen nehmen und die drei Dateien entfernen. */
export async function bildLoeschen(id: string): Promise<Ergebnis> {
  const { supabase, user, h } = await laden();
  if (!h) return { ok: false };
  const bild = h.bilder.find((b) => b.id === id);
  if (!bild) return { ok: true };
  if (!(await schreiben(supabase, user.id, bildEntfernen(h, id)))) return { ok: false };
  // Erst die Liste, dann die Dateien: Scheitert das Entfernen, zeigt die App das Bild trotzdem nicht mehr
  await supabase.storage.from(BUCKET).remove([bild.pfad, bild.mittel, bild.weich]);
  return { ok: true };
}

/** Hochladen abgebrochen oder gescheitert: halb hochgeladene Fassungen wieder entfernen. */
export async function uploadVerwerfen(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const pfade = ["webp", "jpg"].flatMap((e) => [`${id}.${e}`, `${id}-m.${e}`, `${id}-w.${e}`]).map((n) => `${user.id}/${n}`);
  await supabase.storage.from(BUCKET).remove(pfade);
}
