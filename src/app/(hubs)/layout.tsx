import { kiKonfiguriert } from "@/lib/ki/anbieter";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { Sidebar } from "@/components/sidebar";
import { QuickAdd } from "@/components/quick-add";

// Gemeinsamer Rahmen aller Hubs: Sidebar, Theme, Streak (ALL-01: nur eingeloggt).
export default async function HubLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  // Schnell erfassen (Taste Q) gibt es in der ganzen App – dafür die Auswahllisten laden
  const [{ data: settingsRoh }, { data: faecher }, { data: todos }, { data: pruefungen }] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("todo").select("id, titel, erledigt, parent_id").eq("erledigt", false).order("erstellt_am", { ascending: true }).limit(200),
    supabase.from("pruefung").select("id, titel").order("datum", { ascending: true }).limit(100),
  ]);
  const settings = settingsRoh ? await pruefeUndAktualisiereStreak(supabase, user.id, settingsRoh) : null;

  return (
    <div className="dashboard" data-theme={settings?.theme === "DUNKEL" ? "dark" : "light"}>
      <Sidebar
        email={user.email ?? ""}
        theme={settings?.theme ?? "HELL"}
        streak={settings?.streak_count ?? 0}
        kiEingewilligt={Boolean(settings?.ki_einwilligung)}
        audioEingewilligt={Boolean(settings?.ki_audio_einwilligung)}
        kiVerfuegbar={kiKonfiguriert()}
      />
      <main className="dashboard-main hub-main">{children}</main>
      <QuickAdd faecher={faecher ?? []} todos={todos ?? []} pruefungen={pruefungen ?? []} ohneKnopf />
    </div>
  );
}
