import { createClient } from "@/lib/supabase/server";
import { einstellungenLesen } from "@/lib/work-station/timer";
import { fachVorschlag } from "@/lib/work-station/kontext";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";
import { WorkStation, type TagesEintrag, type AufgabeOption } from "@/components/work-station/work-station";

export const metadata = { title: "Work Station · UniVerse" };

export default async function WorkStationSeite({ searchParams }: { searchParams: Promise<{ fach?: string }> }) {
  const { fach: fachAusLink } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const heuteBeginn = berlinMitternacht(berlinDatum()).toISOString();

  const vor30Tagen = berlinMitternacht(berlinDatum(), -30).toISOString();
  const [
    { data: settings },
    { data: faecher, error: fachFehler },
    { data: sitzungen, error: sitzungFehler },
    { data: deadlines },
    { data: todos },
    { data: pruefungen },
  ] = await Promise.all([
    // Spalte work_station fehlt evtl. noch (Migration) -> dann Standardwerte
    supabase.from("settings").select("work_station").eq("user_id", user?.id ?? "").maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("lern_session").select("fach_id, dauer_minuten").gte("start", heuteBeginn),
    // Offene Aufgaben für „Woran arbeitest du?“
    supabase.from("deadline").select("id, titel, fach_id, faellig_am, typ").eq("erledigt", false).gte("faellig_am", vor30Tagen).order("faellig_am").limit(60),
    supabase.from("todo").select("id, titel, fach_id, faellig_am").eq("erledigt", false).order("erstellt_am", { ascending: false }).limit(60),
    supabase.from("pruefung").select("id, titel, fach_id, datum").eq("status", "ANSTEHEND").order("datum").limit(20),
  ]);
  const kurzDatum = (iso: string | null) => (iso ? new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(iso)) : null);
  const aufgaben: AufgabeOption[] = [
    ...(deadlines ?? []).map((d) => ({ typ: "deadline" as const, id: d.id, titel: d.titel, fachId: d.fach_id, gruppe: d.typ === "GRUPPENARBEIT" ? "Gruppenarbeiten" : "Abgaben und Fristen", wann: kurzDatum(d.faellig_am) })),
    ...(todos ?? []).map((t) => ({ typ: "todo" as const, id: t.id, titel: t.titel, fachId: t.fach_id, gruppe: "To-dos", wann: kurzDatum(t.faellig_am) })),
    ...(pruefungen ?? []).map((p) => ({ typ: "pruefung" as const, id: p.id, titel: p.titel, fachId: p.fach_id, gruppe: "Prüfungsvorbereitung", wann: kurzDatum(p.datum) })),
  ];

  const liste = faecher ?? [];
  // KI-12: Aktionskarte "Lernsession" öffnet die Work Station mit vorausgewähltem Fach
  const ausLink = typeof fachAusLink === "string" ? liste.find((f) => f.id === fachAusLink) : undefined;
  const vorschlag = ausLink ? { fachId: ausLink.id, grund: "Vom Assistenten vorgeschlagen" } : await fachVorschlag(supabase, liste);

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
      aufgaben={aufgaben}
      heuteFehler={Boolean(fachFehler || sitzungFehler)}
    />
  );
}
