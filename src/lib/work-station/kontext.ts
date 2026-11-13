import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { berlinDatum, berlinMitternacht, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";

export type FachVorschlag = { fachId: string; grund: string };

/**
 * WS-02 (Context Engine): Läuft gerade eine Vorlesung oder steht eine Deadline/Prüfung an,
 * wird dieses Fach vorausgewählt.
 */
export async function fachVorschlag(
  supabase: SupabaseClient<Database>,
  faecher: { id: string; name: string }[],
  jetzt: Date = new Date(),
): Promise<FachVorschlag | null> {
  const name = (id: string) => faecher.find((f) => f.id === id)?.name ?? "Fach";
  const aktiv = new Set(faecher.map((f) => f.id));
  const bis = new Date(jetzt.getTime() + 3 * 24 * 3600_000).toISOString();

  const [{ data: stundenplan }, { data: deadlines }, { data: pruefungen }] = await Promise.all([
    supabase.from("stundenplan_eintrag").select("fach_id, tag, start_zeit, end_zeit"),
    supabase
      .from("deadline")
      .select("fach_id, titel, faellig_am")
      .eq("erledigt", false)
      .not("fach_id", "is", null)
      .gte("faellig_am", jetzt.toISOString())
      .lte("faellig_am", bis)
      .order("faellig_am", { ascending: true })
      .limit(5),
    supabase
      .from("pruefung")
      .select("fach_id, titel, datum")
      .gte("datum", berlinMitternacht(berlinDatum(jetzt)).toISOString())
      .lte("datum", new Date(jetzt.getTime() + 7 * 24 * 3600_000).toISOString())
      .order("datum", { ascending: true })
      .limit(5),
  ]);

  const tag = berlinWochentag(jetzt);
  const uhr = berlinUhrzeit(jetzt);
  const vorlesung = (stundenplan ?? []).find(
    (e) => aktiv.has(e.fach_id) && e.tag === tag && e.start_zeit.slice(0, 5) <= uhr && uhr < e.end_zeit.slice(0, 5),
  );
  if (vorlesung) return { fachId: vorlesung.fach_id, grund: `Laut Stundenplan läuft gerade ${name(vorlesung.fach_id)}.` };

  const pruefung = (pruefungen ?? []).find((p) => p.fach_id && aktiv.has(p.fach_id));
  if (pruefung?.fach_id) return { fachId: pruefung.fach_id, grund: `Bald ist Prüfung: ${pruefung.titel}.` };

  const deadline = (deadlines ?? []).find((d) => d.fach_id && aktiv.has(d.fach_id));
  if (deadline?.fach_id) return { fachId: deadline.fach_id, grund: `Bald fällig: ${deadline.titel}.` };

  return null;
}
