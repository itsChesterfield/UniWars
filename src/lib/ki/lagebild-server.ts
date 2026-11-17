// Kompaktes Lagebild für UniVerse Studio (server-only): das Wichtigste der nächsten Tage,
// damit Alltagsfragen ohne zusätzliche Werkzeug-Runden beantwortet werden (deutlich schneller).
import "server-only";
import type { Supabase } from "@/lib/ki/server";
import { berlinDatum, berlinMitternacht, berlinWochentag } from "@/lib/zeit";
import { markerEntschaerfen } from "@/lib/ki/material";

const TAGNAME: Record<string, string> = { MO: "Mo", DI: "Di", MI: "Mi", DO: "Do", FR: "Fr", SA: "Sa", SO: "So" };

function kurzDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

export async function lagebildText(supabase: Supabase): Promise<string> {
  const jetzt = new Date();
  const heute = berlinDatum(jetzt);
  const morgen = new Date(jetzt.getTime() + 86_400_000);
  const tagHeute = berlinWochentag(jetzt);
  const tagMorgen = berlinWochentag(morgen);
  const in14 = new Date(jetzt.getTime() + 14 * 86_400_000).toISOString();
  const in30 = new Date(jetzt.getTime() + 30 * 86_400_000).toISOString();
  const [{ data: faecher }, { data: stunden }, { data: deadlines }, { data: pruefungen }, { data: todos }, { count: karten }, { data: studium }] = await Promise.all([
    supabase.from("fach").select("id, name"),
    supabase.from("stundenplan_eintrag").select("fach_id, tag, start_zeit, raum").in("tag", [tagHeute, tagMorgen]).order("start_zeit"),
    supabase.from("deadline").select("titel, faellig_am, fach_id, typ").eq("erledigt", false).gte("faellig_am", jetzt.toISOString()).lte("faellig_am", in14).order("faellig_am").limit(12),
    supabase.from("pruefung").select("titel, datum, fach_id").eq("status", "ANSTEHEND").gte("datum", berlinMitternacht(heute).toISOString()).lte("datum", in30).order("datum").limit(6),
    supabase.from("todo").select("titel").eq("erledigt", false).is("parent_id", null).order("erstellt_am", { ascending: false }).limit(10),
    supabase.from("kk_karte").select("id", { count: "exact", head: true }).lte("naechste_abfrage", jetzt.toISOString()),
    supabase.from("settings").select("hochschule_frei, hochschule(name, ort, art)").maybeSingle(),
  ]);
  const hs = studium?.hochschule;
  const hochschule = hs ? `${hs.name}${hs.ort ? ` (${hs.ort})` : ""}${hs.art === "fh" ? ", Hochschule für angewandte Wissenschaften" : ""}` : studium?.hochschule_frei;
  const fach = (id: string | null) => (faecher ?? []).find((f) => f.id === id)?.name ?? null;
  const t = (s: string) => markerEntschaerfen(s).slice(0, 80);
  const vorlesungen = (tag: string) =>
    (stunden ?? [])
      .filter((s) => s.tag === tag)
      .map((s) => `${s.start_zeit.slice(0, 5)} ${t(fach(s.fach_id) ?? "Vorlesung")}${s.raum ? ` (${t(s.raum)})` : ""}`)
      .join(", ") || "keine";
  const zeilen = [
    ...(hochschule ? [`- Studiert an: ${markerEntschaerfen(hochschule).slice(0, 160)}`] : []),
    `- Vorlesungen heute (${TAGNAME[tagHeute]}): ${vorlesungen(tagHeute)}`,
    `- Vorlesungen morgen (${TAGNAME[tagMorgen]}): ${vorlesungen(tagMorgen)}`,
    `- Offene Deadlines (14 Tage): ${(deadlines ?? []).map((d) => `${t(d.titel)}${fach(d.fach_id) ? ` [${t(fach(d.fach_id)!)}]` : ""} – ${kurzDatum(d.faellig_am)}`).join("; ") || "keine"}`,
    `- Prüfungen (30 Tage): ${(pruefungen ?? []).map((p) => `${t(p.titel)}${fach(p.fach_id) ? ` [${t(fach(p.fach_id)!)}]` : ""} – ${kurzDatum(p.datum)}`).join("; ") || "keine"}`,
    `- Offene To-dos (${(todos ?? []).length >= 10 ? "10+" : (todos ?? []).length}): ${(todos ?? []).map((x) => t(x.titel)).join("; ") || "keine"}`,
    `- Fällige Karteikarten: ${karten ?? 0}`,
  ];
  return zeilen.join("\n");
}
