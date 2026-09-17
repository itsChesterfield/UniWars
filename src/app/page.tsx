import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { FachManager } from "@/components/fach-manager";
import { DeadlineManager } from "@/components/deadline-manager";
import { TodoManager } from "@/components/todo-manager";
import { NoteManager } from "@/components/note-manager";
import { PruefungManager } from "@/components/pruefung-manager";
import { StundenplanManager } from "@/components/stundenplan-manager";

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
  ] = await Promise.all([
    supabase.from("fach").select("*").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("deadline").select("*").order("faellig_am", { ascending: true }),
    supabase.from("todo").select("*").order("erstellt_am", { ascending: true }),
    supabase.from("note").select("*").order("datum", { ascending: false }),
    supabase.from("pruefung").select("*").order("datum", { ascending: true }),
    supabase.from("stundenplan_eintrag").select("*"),
    supabase.rpc("notenschnitt"),
  ]);

  const error =
    faecherError ||
    deadlinesError ||
    todosError ||
    notesError ||
    pruefungenError ||
    stundenplanError ||
    notenschnittError;
  if (error) throw new Error(error.message);

  const faecherListe = faecher ?? [];

  return (
    <div className="dashboard">
      <Sidebar email={user.email ?? ""} />
      <main className="dashboard-main">
        <h1>Übersicht</h1>
        <FachManager initialFaecher={faecherListe} />
        <StundenplanManager
          initialEintraege={stundenplanEintraege ?? []}
          faecher={faecherListe}
        />
        <DeadlineManager initialDeadlines={deadlines ?? []} faecher={faecherListe} />
        <TodoManager initialTodos={todos ?? []} faecher={faecherListe} />
        <NoteManager
          initialNotes={notes ?? []}
          faecher={faecherListe}
          notenschnitt={notenschnitt}
        />
        <PruefungManager initialPruefungen={pruefungen ?? []} faecher={faecherListe} />
      </main>
    </div>
  );
}
