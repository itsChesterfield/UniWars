import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { speiseplan } from "@/lib/mensa-server";
import { semesterLage } from "@/lib/semester-server";
import { semesterName, semesterStand, datumKurz } from "@/lib/semester";
import { berlinDatum } from "@/lib/zeit";
import { googleEinrichtungsProbleme } from "@/lib/kalender/google";
import { abgleichNachLadenPlanen } from "@/lib/kalender/anstossen";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";
import { DashboardContent } from "@/components/dashboard-content";
import type { Bereich } from "@/lib/dashboard-bereiche";
import { anzeigeName } from "@/lib/anzeige-name";
import { EINRICHTUNG_COOKIE, einrichtungZeigen, standLesen } from "@/lib/einrichtung";


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
    { data: settingsRoh, error: settingsError },
    { data: kalenderVerbindung },
    { data: faelligeKarten },
    { data: zuletztDateien },
  ] = await Promise.all([
    supabase.from("fach").select("*").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("deadline").select("*").order("faellig_am", { ascending: true }),
    supabase.from("todo").select("*").order("erstellt_am", { ascending: true }),
    supabase.from("note").select("*").order("datum", { ascending: false }),
    supabase.from("pruefung").select("*").order("datum", { ascending: true }),
    supabase.from("stundenplan_eintrag").select("*"),
    supabase.rpc("notenschnitt"),
    supabase.from("lern_session").select("*"),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase
      .from("kalender_verbindung")
      .select("zuletzt_abgeglichen")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Fällige Karteikarten für „Überblick“ und „Wiederholen“. Immer laden: Die Notch wechselt ohne neuen Server-Aufruf.
    supabase.from("kk_karte").select("stapel_id, stapel:stapel_id(name)").lte("naechste_abfrage", new Date().toISOString()).limit(1000),
    // Szene „Zuletzt geöffnet“ der Hub-Bühne
    supabase.from("datei").select("id, name, mime_typ, geaendert_am, fach_id").order("geaendert_am", { ascending: false }).limit(6),
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
    settingsError;
  if (error) throw new Error(error.message);

  const settings = await pruefeUndAktualisiereStreak(supabase, user.id, settingsRoh);

  // Einrichtung beim ersten Login: nur neue, leere Konten oder eine laufende Einrichtung
  if (bereich === "uebersicht") {
    const stand = standLesen((await cookies()).get(EINRICHTUNG_COOKIE)?.value);
    const konto = {
      seit: user.created_at,
      faecher: faecher?.length ?? 0,
      aufgaben: (deadlines?.length ?? 0) + (todos?.length ?? 0),
      stundenplan: stundenplanEintraege?.length ?? 0,
      hochschule: Boolean(settings.hochschule_id || settings.hochschule_frei),
      mensa: Boolean(settings.mensa_id),
    };
    if (einrichtungZeigen(stand, konto, new Date())) redirect("/einrichtung");
  }

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
  // Alle Bereiche bekommen dieselben Daten: Die Notch blendet nur um (OpenMensa 30 min zwischengespeichert)
  const [mensa, sem] = await Promise.all([
    settings.mensa_id ? speiseplan(settings.mensa_id, settings.mensa_name ?? "Mensa") : null,
    settings.hochschule_id ? semesterLage(supabase).catch(() => null) : null,
  ]);
  const semesterText = sem ? semesterKurz(sem.termine, sem.land) : null;
  // Rahmen (Symbolleiste, Kopfleiste, Glocke) kommt aus app/(hubs)/layout.tsx und bleibt beim Wechsel stehen
  return (
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
        serverJetzt={new Date().toISOString()}
        bereich={bereich}
        mensa={mensa}
        semester={semesterText}
        dateien={zuletztDateien ?? []}
      />
    </Suspense>
  );
}

/** Kurzinfo für „Diese Woche“, z. B. „WiSe 2026/27 · Vorlesungswoche 6 von 17“ */
function semesterKurz(t: Parameters<typeof semesterStand>[0], land: string): string {
  const s = semesterStand(t, berlinDatum(new Date()));
  const wann =
    s.phase === "vorlesungen"
      ? `Vorlesungswoche ${s.woche} von ${s.wochen}`
      : s.phase === "vor_beginn"
        ? `Vorlesungen ab ${datumKurz(t.vorlesung_beginn)}`
        : s.phase === "pruefungen"
          ? "Prüfungszeit"
          : "vorlesungsfrei";
  return `${semesterName(t.semester, land, true)}, ${wann}`;
}
