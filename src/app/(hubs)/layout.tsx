import { kiKonfiguriert } from "@/lib/ki/anbieter";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { Sidebar } from "@/components/sidebar";

// Gemeinsamer Rahmen aller Hubs: Sidebar, Theme, Streak (ALL-01: nur eingeloggt).
export default async function HubLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: settingsRoh } = await supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle();
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
    </div>
  );
}
