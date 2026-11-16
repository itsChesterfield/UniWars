import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { googleEinrichtungsProbleme } from "@/lib/kalender/google";
import { abgleichNachLadenPlanen } from "@/lib/kalender/anstossen";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { Sidebar } from "@/components/sidebar";
import { GeteilteAnsicht } from "@/components/geteilte-ansicht";
import { Kopfleiste } from "@/components/kopfleiste";
import { BereichUebergang } from "@/components/bereich-uebergang";
import { HubKontext } from "@/components/hub/hub-kontext";
import { DashboardContent } from "@/components/dashboard-content";
import type { Bereich } from "@/lib/dashboard-bereiche";
import { anzeigeName } from "@/lib/anzeige-name";
import { profilbildUrl } from "@/lib/profilbild";


/**
 * Zentraler Hub: lädt alles und zeigt je nach Bereich die ganze Übersicht oder
 * nur einen Teil als eigene Seite (Termine, Aufgaben, Noten, Fortschritt, Fächer –
 * erreichbar über die Kontextspalte).
 */
export async function DashboardSeite({ bereich }: { bereich: Bereich }) {
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
    { data: kalenderVerbindung },
    { data: faelligeKarten },
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
    supabase
      .from("kalender_verbindung")
      .select("zuletzt_abgeglichen")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Fällige Karteikarten für „Überblick“ und „Wiederholen“. Ohne Karteikarten-Tabelle bleibt es bei 0.
    bereich === "uebersicht"
      ? supabase.from("kk_karte").select("stapel_id, stapel:stapel_id(name)").lte("naechste_abfrage", new Date().toISOString()).limit(1000)
      : Promise.resolve({ data: null }),
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

  const kalenderProbleme = googleEinrichtungsProbleme();
  const kalenderKonfiguriert = kalenderProbleme.length === 0;
  if (kalenderKonfiguriert && kalenderVerbindung && session) {
    abgleichNachLadenPlanen(session.access_token, user.id, kalenderVerbindung.zuletzt_abgeglichen);
  }

  const proStapel = new Map<string, { id: string; name: string; anzahl: number }>();
  for (const k of faelligeKarten ?? []) {
    const s = proStapel.get(k.stapel_id) ?? { id: k.stapel_id, name: (k.stapel as { name?: string } | null)?.name ?? "Karteikarten", anzahl: 0 };
    s.anzahl++;
    proStapel.set(k.stapel_id, s);
  }
  const karten = { anzahl: faelligeKarten?.length ?? 0, stapel: [...proStapel.values()].sort((a, b) => b.anzahl - a.anzahl) };

  const username = anzeigeName(settings, user);
  const avatarUrl = await profilbildUrl(supabase, settings.avatar_pfad);

  return (
    <div className="dashboard" data-theme={settings.theme === "DUNKEL" ? "nacht" : "hochschule"}>
      <Sidebar name={username} email={user.email ?? ""} avatarUrl={avatarUrl} theme={settings.theme} kiVerfuegbar={kiKonfiguriert()} />
      <Suspense fallback={null}>
        <HubKontext aktiv={bereich} faecher={faecher ?? []} deadlines={deadlines ?? []} pruefungen={pruefungen ?? []} />
      </Suspense>
      <div className="arbeitsflaeche">
        <Kopfleiste
          name={username}
          avatarUrl={avatarUrl}
          streak={settings.streak_count}
          kiVerfuegbar={kiKonfiguriert()}
          benachrichtigungen={benachrichtigungen ?? []}
          einladungen={einladungen ?? []}
        />
        <GeteilteAnsicht mainKlasse={bereich === "uebersicht" ? "dashboard-main hub-zentral hub-randlos" : "dashboard-main hub-zentral"}>
        <BereichUebergang>
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
            settings={settings}
            username={username}
            userId={user.id}
            kalender={{
              konfiguriert: kalenderKonfiguriert,
              verbunden: Boolean(kalenderVerbindung),
              probleme: kalenderProbleme,
            }}
            karten={karten}
            bereich={bereich}
          />
        </Suspense>
        </BereichUebergang>
        </GeteilteAnsicht>
      </div>
    </div>
  );
}
