"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type DetailZielTyp = "todo" | "deadline" | "pruefung";

export type DetailMitglied = {
  user_id: string;
  username: string | null;
  rolle: "ERSTELLER" | "DABEI" | "EINGELADEN";
  initiale: string;
};

export type DetailUnteraufgabe = {
  id: string;
  titel: string;
  erledigt: boolean;
  zugewiesenAn: string | null;
  faelligAm: string | null;
};

export type DetailAnhang = Tables<"anhang">;

export type DetailDaten = {
  typ: DetailZielTyp;
  titel: string;
  fachId: string | null;
  fach: { name: string; farbe: string | null } | null;
  faelligAm: string | null;
  countdownTage: number | null;
  mitglieder: DetailMitglied[];
  unteraufgaben: DetailUnteraufgabe[];
  anhaenge: DetailAnhang[];
};

export async function detailLaden(zielTyp: DetailZielTyp, zielId: string): Promise<DetailDaten> {
  const supabase = await createClient();

  let titel: string;
  let fachId: string | null;
  let faelligAmRoh: string | null;

  if (zielTyp === "deadline") {
    const { data, error } = await supabase
      .from("deadline")
      .select("titel, fach_id, faellig_am")
      .eq("id", zielId)
      .single();
    if (error) throw new Error(error.message);
    titel = data.titel;
    fachId = data.fach_id;
    faelligAmRoh = data.faellig_am;
  } else if (zielTyp === "todo") {
    const { data, error } = await supabase
      .from("todo")
      .select("titel, fach_id, faellig_am")
      .eq("id", zielId)
      .single();
    if (error) throw new Error(error.message);
    titel = data.titel;
    fachId = data.fach_id;
    faelligAmRoh = data.faellig_am;
  } else {
    const { data, error } = await supabase
      .from("pruefung")
      .select("titel, fach_id, datum")
      .eq("id", zielId)
      .single();
    if (error) throw new Error(error.message);
    titel = data.titel;
    fachId = data.fach_id;
    faelligAmRoh = data.datum;
  }

  let fach: { name: string; farbe: string | null } | null = null;
  if (fachId) {
    const { data } = await supabase.from("fach").select("name, farbe").eq("id", fachId).maybeSingle();
    fach = data;
  }

  const countdownTage = faelligAmRoh
    ? Math.ceil((new Date(faelligAmRoh).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const mitgliederAntwort =
    zielTyp === "deadline"
      ? await supabase.rpc("deadline_mitglieder", { p_deadline_id: zielId })
      : zielTyp === "todo"
        ? await supabase.rpc("todo_mitglieder", { p_todo_id: zielId })
        : await supabase.rpc("pruefung_mitglieder", { p_pruefung_id: zielId });
  if (mitgliederAntwort.error) throw new Error(mitgliederAntwort.error.message);

  const mitgliederSortiert = [...(mitgliederAntwort.data ?? [])].sort((a, b) => {
    if (a.ist_ersteller !== b.ist_ersteller) return a.ist_ersteller ? -1 : 1;
    return (a.username ?? "").localeCompare(b.username ?? "");
  });

  const mitglieder: DetailMitglied[] = mitgliederSortiert.map((m) => ({
    user_id: m.user_id,
    username: m.username,
    rolle: m.ist_ersteller ? "ERSTELLER" : m.status === "ANGENOMMEN" ? "DABEI" : "EINGELADEN",
    initiale: (m.username ?? "?").slice(0, 1).toUpperCase(),
  }));

  let unteraufgaben: DetailUnteraufgabe[] = [];
  if (zielTyp === "todo") {
    const { data, error } = await supabase
      .from("todo")
      .select("id, titel, erledigt, zugewiesen_an, faellig_am")
      .eq("parent_id", zielId)
      .order("erstellt_am", { ascending: true });
    if (error) throw new Error(error.message);
    unteraufgaben = (data ?? []).map((t) => ({
      id: t.id,
      titel: t.titel,
      erledigt: t.erledigt,
      zugewiesenAn: t.zugewiesen_an,
      faelligAm: t.faellig_am,
    }));
  } else if (zielTyp === "deadline") {
    const { data, error } = await supabase
      .from("deadline")
      .select("id, titel, erledigt, faellig_am, zugewiesen_an")
      .eq("parent_deadline_id", zielId)
      .order("faellig_am", { ascending: true });
    if (error) throw new Error(error.message);
    unteraufgaben = (data ?? []).map((d) => ({
      id: d.id,
      titel: d.titel,
      erledigt: d.erledigt,
      zugewiesenAn: d.zugewiesen_an,
      faelligAm: d.faellig_am,
    }));
  } else {
    const { data, error } = await supabase
      .from("deadline")
      .select("id, titel, erledigt, faellig_am, zugewiesen_an")
      .eq("pruefung_id", zielId)
      .order("faellig_am", { ascending: true });
    if (error) throw new Error(error.message);
    unteraufgaben = (data ?? []).map((d) => ({
      id: d.id,
      titel: d.titel,
      erledigt: d.erledigt,
      zugewiesenAn: d.zugewiesen_an,
      faelligAm: d.faellig_am,
    }));
  }

  const { data: anhaengeRoh, error: anhaengeError } = await supabase
    .from("anhang")
    .select("*")
    .eq("ziel_typ", zielTyp)
    .eq("ziel_id", zielId)
    .order("erstellt_am", { ascending: true });
  if (anhaengeError) throw new Error(anhaengeError.message);

  return {
    typ: zielTyp,
    titel,
    fachId,
    fach,
    faelligAm: faelligAmRoh,
    countdownTage,
    mitglieder,
    unteraufgaben,
    anhaenge: anhaengeRoh ?? [],
  };
}
