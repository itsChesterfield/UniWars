import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { FachManager } from "@/components/fach-manager";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: faecher, error } = await supabase
    .from("fach")
    .select("*")
    .eq("aktiv", true)
    .order("erstellt_am", { ascending: true });

  if (error) throw new Error(error.message);

  return (
    <div className="dashboard">
      <Sidebar email={user.email ?? ""} />
      <main className="dashboard-main">
        <h1>Übersicht</h1>
        <FachManager initialFaecher={faecher ?? []} />
      </main>
    </div>
  );
}
