import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { Sidebar } from "@/components/sidebar";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: faecher, error: faecherError },
    { data: deadlines, error: deadlinesError },
    { data: todos, error: todosError },
    { data: notes, error: notesError },
    { data: pruefungen, error: pruefungenError },
    { data: stundenplanEintraege, error: stundenplanError },
    { data: notenschnitt, error: notenschnittError },
    { data: lernSessions, error: lernSessionError },
    { data: benachrichtigungen, error: benachrichtigungError },
    { data: settingsRoh, error: settingsError },
  ] = await Promise.all([
    supabase.from("fach").select("*").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("deadline").select("*").order("faellig_am", { ascending: true }),
    supabase.from("todo").select("*").order("erstellt_am", { ascending: true }),
    supabase.from("note").select("*").order("datum", { ascending: false }),
    supabase.from("pruefung").select("*").order("datum", { ascending: true }),
    supabase.from("stundenplan_eintrag").select("*"),
    supabase.rpc("notenschnitt"),
    supabase.from("lern_session").select("*"),
    supabase
      .from("benachrichtigung")
      .select("*")
      .order("erstellt_am", { ascending: false })
      .limit(20),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ]);

  const error =
    faecherError ||
    deadlinesError ||
    todosError ||
    notesError ||
    pruefungenError ||
    stundenplanError ||
    notenschnittError ||
    lernSessionError ||
    benachrichtigungError ||
    settingsError;
  if (error) throw new Error(error.message);

  const settings = await pruefeUndAktualisiereStreak(supabase, user.id, settingsRoh);

  const username =
    typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim() !== ""
      ? user.user_metadata.username
      : (user.email ?? "").split("@")[0];

  return (
    <div className="dashboard" data-theme={settings.theme === "DUNKEL" ? "dark" : "light"}>
      <Sidebar email={user.email ?? ""} theme={settings.theme} streak={settings.streak_count} />
      <main className="dashboard-main">
        <Suspense fallback={null}>
          <DashboardContent
            faecher={faecher ?? []}
            deadlines={deadlines ?? []}
            todos={todos ?? []}
            notes={notes ?? []}
            pruefungen={pruefungen ?? []}
            stundenplanEintraege={stundenplanEintraege ?? []}
            notenschnitt={notenschnitt}
            lernSessions={lernSessions ?? []}
            benachrichtigungen={benachrichtigungen ?? []}
            sichtbareWidgets={(settings.sichtbare_widgets as string[]) ?? []}
            settings={settings}
            username={username}
          />
        </Suspense>
      </main>
    </div>
  );
}
