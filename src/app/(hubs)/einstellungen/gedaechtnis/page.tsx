import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { GedaechtnisVerwaltung } from "@/components/ki/gedaechtnis-verwaltung";
import { eintraegeLesen, kennenlernenStatus, rhythmusText, rueckblick } from "@/lib/ki/gedaechtnis";

export const metadata = { title: "Was Studio über dich weiß · UniWars" };

/** Persönliches Modell: alles einsehen, korrigieren, löschen – und den Wissensstand sehen */
export default async function GedaechtnisSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const jetzt = new Date();
  const seit = new Date(jetzt.getTime() - 60 * 86_400_000).toISOString();
  const [{ data: roh }, { data: settings }, { data: themen }, { data: sitzungen }] = await Promise.all([
    supabase.from("ki_gedaechtnis").select("id, bereich, inhalt, quelle, sicherheit, status, fest, zuletzt_genutzt, erstellt_am").neq("status", "verworfen").order("erstellt_am", { ascending: false }).limit(300),
    supabase.from("settings").select("ki_gedaechtnis_an, ki_kennenlernen").eq("user_id", user.id).maybeSingle(),
    supabase.from("ki_thema_stand").select("id, thema, beherrschung, versuche, fehlerbild, fach:fach_id(name, farbe)").order("beherrschung", { ascending: true }).limit(120),
    supabase.from("lern_session").select("start, dauer_minuten").gte("start", seit).limit(300),
  ]);
  const eintraege = eintraegeLesen(roh ?? []);
  return (
    <>
      <HubKopf titel="Was Studio über dich weiß" untertitel="UniVerse Studio lernt dich mit jeder Woche besser kennen – hier siehst und steuerst du alles." />
      <GedaechtnisVerwaltung
        startEintraege={eintraege}
        lernenAn={settings?.ki_gedaechtnis_an !== false}
        kennenlernen={kennenlernenStatus(settings?.ki_kennenlernen, jetzt)}
        rueckblickIds={rueckblick(eintraege, jetzt).map((e) => e.id)}
        themen={(themen ?? []).map((t) => {
          const f = t.fach as { name?: string; farbe?: string | null } | null;
          return { id: t.id, thema: t.thema, beherrschung: t.beherrschung, versuche: t.versuche, fehlerbild: t.fehlerbild, fach: f?.name ?? null, farbe: f?.farbe ?? null };
        })}
        rhythmus={rhythmusText(sitzungen ?? [])}
      />
    </>
  );
}
