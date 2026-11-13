import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { ChatHub } from "@/components/chat/chat-hub";

export const metadata = { title: "Chat · UniWars" };

export default async function ChatSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: chats, error }, { data: blockiert }, { data: gruppenarbeiten }] = await Promise.all([
    supabase.rpc("chat_uebersicht"),
    supabase.from("nutzer_blockiert").select("blockiert_id"),
    supabase.from("deadline").select("id, titel").eq("typ", "GRUPPENARBEIT").eq("erledigt", false).order("faellig_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error) || error?.code === "PGRST202") {
    return (
      <>
        <HubKopf titel="Chat" />
        <EinrichtungHinweis hub="Der Chat" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <ChatHub
        ich={user?.id ?? ""}
        startChats={chats ?? []}
        startBlockiert={(blockiert ?? []).map((b) => b.blockiert_id)}
        gruppenarbeiten={gruppenarbeiten ?? []}
      />
    </Suspense>
  );
}
