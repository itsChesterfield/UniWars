// Transkription: Server-Hilfen (immer mit dem Supabase-Client des Nutzers, RLS).
import "server-only";
import type { Supabase } from "@/lib/ki/server";
import type { Json } from "@/lib/supabase/types";
import { absaetzeAlsText, absaetzeBilden, type Segment } from "@/lib/transkription/transkript";

/**
 * Wenn alle Teile fertig sind: Absätze und Fließtext des Transkripts bilden.
 * Schon vorhandene (evtl. bearbeitete) Absätze werden nicht überschrieben.
 * Gibt zurück, ob das Transkript danach vollständig ist.
 */
export async function transkriptZusammensetzen(supabase: Supabase, transkriptId: string): Promise<boolean> {
  const [{ data: teile }, { data: transkript }] = await Promise.all([
    supabase.from("transkript_teil").select("nr, status, text, segmente").eq("transkript_id", transkriptId),
    supabase.from("transkript").select("absaetze").eq("id", transkriptId).maybeSingle(),
  ]);
  if (!teile?.length || !transkript || teile.some((t) => t.status !== "fertig")) return false;
  if (Array.isArray(transkript.absaetze) && transkript.absaetze.length > 0) return true;
  const absaetze = absaetzeBilden(teile.map((t) => ({ nr: t.nr, text: t.text, segmente: (Array.isArray(t.segmente) ? t.segmente : []) as unknown as Segment[] })));
  const { error } = await supabase
    .from("transkript")
    .update({ absaetze: absaetze as unknown as Json, text: absaetzeAlsText(absaetze) })
    .eq("id", transkriptId);
  return !error;
}
