import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { Sidebar } from "@/components/sidebar";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const supabase = await createClient();

  // proxy.ts (Middleware) already ran auth.getUser() for this exact request
  // and refreshed the session cookie, so reading it back here needs no
  // second network round-trip to Supabase.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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
    { data: einladungen, error: einladungenError },
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
    supabase
      .from("einladung")
      .select("*")
      .eq("an_user_id", user.id)
      .eq("status", "OFFEN")
      .order("erstellt_am", { ascending: false }),
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
    settingsError ||
    einladungenError;
  if (error) throw new Error(error.message);

  const settings = await pruefeUndAktualisiereStreak(supabase, user.id, settingsRoh);

  const username =
    typeof settings.username === "string" && settings.username.trim() !== ""
      ? settings.username
      : typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim() !== ""
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
            einladungen={einladungen ?? []}
            sichtbareWidgets={(settings.sichtbare_widgets as string[]) ?? []}
            settings={settings}
            username={username}
            userId={user.id}
          />
        </Suspense>
      </main>
    </div>
  );
}
