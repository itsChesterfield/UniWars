import "server-only";

import { tabelleFehlt } from "@/lib/hubs/datenbank";
import type { createClient } from "@/lib/supabase/server";
import type { HubMaterial, MaterialArt } from "./material";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Zeile = { id: string; fach_id: string | null } & ({ titel: string } | { name: string });

export async function hubMaterialLaden(supabase: Supabase): Promise<HubMaterial[]> {
  const antworten = await Promise.all([
    supabase.from("notiz").select("id, titel, fach_id"),
    supabase.from("kk_stapel").select("id, name, fach_id"),
    supabase.from("praesentation").select("id, titel, fach_id"),
    supabase.from("whiteboard").select("id, name, fach_id"),
    supabase.from("mindmap").select("id, name, fach_id"),
    supabase.from("dokument").select("id, titel, fach_id"),
    supabase.from("tabelle").select("id, titel, fach_id"),
    supabase.from("transkript").select("id, titel, fach_id"),
    supabase.from("podcast").select("id, titel, fach_id"),
    supabase.from("quiz").select("id, titel, fach_id"),
    supabase.from("literatur_quelle").select("id, titel, fach_id"),
  ]);
  const arten: MaterialArt[] = [
    "notiz", "stapel", "praesentation", "whiteboard", "mindmap", "dokument",
    "tabelle", "transkript", "podcast", "quiz", "literatur",
  ];

  return antworten.flatMap(({ data, error }, index) => {
    if (error && !tabelleFehlt(error)) throw error;
    return (data as Zeile[] | null ?? []).map((zeile) => ({
      art: arten[index],
      id: zeile.id,
      titel: ("titel" in zeile ? zeile.titel : zeile.name) || "Ohne Titel",
      fachId: zeile.fach_id,
    }));
  });
}
