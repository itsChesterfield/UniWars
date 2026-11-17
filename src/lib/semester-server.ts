import "server-only";
import type { Supabase } from "@/lib/ki/server";
import { berlinDatum } from "@/lib/zeit";
import { semesterZu, standardTermine, type Art, type SemesterTermine } from "@/lib/semester";

export type SemesterLage = {
  termine: SemesterTermine;
  /** Von Studierenden der Hochschule eingetragen (sonst Richtwerte) */
  gepflegt: boolean;
  geaendertAm: string | null;
  hochschuleId: string;
  land: string;
  art: Art;
};

/** Aktuelles Semester der eigenen Hochschule – gepflegte Termine oder Richtwerte */
export async function semesterLage(supabase: Supabase, semester?: string): Promise<SemesterLage | null> {
  const { data: s } = await supabase.from("settings").select("hochschule(id, land, art)").maybeSingle();
  const hs = s?.hochschule;
  if (!hs) return null;
  const art = (hs.art as Art) ?? "sonstige";
  const key = semester ?? semesterZu(berlinDatum(new Date()), art, hs.land);
  const { data: g } = await supabase.from("hochschule_semester").select("*").eq("hochschule_id", hs.id).eq("semester", key).maybeSingle();
  return {
    termine: g
      ? { semester: key, vorlesung_beginn: g.vorlesung_beginn, vorlesung_ende: g.vorlesung_ende, pruefung_beginn: g.pruefung_beginn, pruefung_ende: g.pruefung_ende, rueckmeldung_bis: g.rueckmeldung_bis }
      : standardTermine(key, art, hs.land),
    gepflegt: Boolean(g),
    geaendertAm: g?.geaendert_am ?? null,
    hochschuleId: hs.id,
    land: hs.land,
    art,
  };
}
