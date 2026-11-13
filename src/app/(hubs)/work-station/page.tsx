import { createClient } from "@/lib/supabase/server";
import { einstellungenLesen } from "@/lib/work-station/timer";
import { fachVorschlag } from "@/lib/work-station/kontext";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";
import { WorkStation, type TagesEintrag } from "@/components/work-station/work-station";

export const metadata = { title: "Work Station · UniWars" };

export default async function WorkStationSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const heuteBeginn = berlinMitternacht(berlinDatum()).toISOString();

  const [{ data: settings }, { data: faecher }, { data: sitzungen }] = await Promise.all([
    // Spalte work_station fehlt evtl. noch (Migration) -> dann Standardwerte
    supabase.from("settings").select("work_station").eq("user_id", user?.id ?? "").maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("lern_session").select("fach_id, dauer_minuten").gte("start", heuteBeginn),
  ]);

  const liste = faecher ?? [];
  const vorschlag = await fachVorschlag(supabase, liste);

  // WS-05: heute gelernt, pro Fach
  const proFach = new Map<string | null, number>();
  for (const s of sitzungen ?? []) proFach.set(s.fach_id, (proFach.get(s.fach_id) ?? 0) + s.dauer_minuten);
  const heute: TagesEintrag[] = [...proFach.entries()]
    .map(([fachId, minuten]) => {
      const fach = liste.find((f) => f.id === fachId);
      return { fachId, name: fach?.name ?? "Allgemein", farbe: fach?.farbe ?? null, minuten };
    })
    .sort((a, b) => b.minuten - a.minuten);

  return (
    <WorkStation
      einstellungen={einstellungenLesen(settings?.work_station)}
      faecher={liste}
      vorschlag={vorschlag}
      heute={heute}
    />
  );
}
