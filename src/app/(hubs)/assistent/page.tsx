import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { AssistentSeite } from "@/components/assistent/assistent-seite";

export const metadata = { title: "Assistent · UniWars" };

/** KI-12: alle Unterhaltungen mit dem Assistenten. */
export default async function AssistentPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ki_unterhaltung").select("id, titel, geaendert_am").order("geaendert_am", { ascending: false }).limit(100);
  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Assistent" />
        <EinrichtungHinweis hub="Der Assistent" />
      </>
    );
  }
  if (error) throw new Error(error.message);
  return <AssistentSeite unterhaltungen={data ?? []} startId={typeof u === "string" ? u : null} />;
}
