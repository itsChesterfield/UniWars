"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { NeueGruppeDialog, NeuerChatDialog } from "@/components/chat/chat-dialoge";
import { ChatVerlauf } from "@/components/chat/chat-verlauf";
import { CHAT_GELESEN_EVENT } from "@/components/chat/chat-punkt";
import type { Database } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";

type Uebersicht = Database["public"]["Functions"]["chat_uebersicht"]["Returns"][number];


function zeit(iso: string) {
  const d = new Date(iso);
  const heute = new Date();
  if (d.toDateString() === heute.toDateString()) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function ChatHub({
  ich,
  startChats,
  startBlockiert,
  gruppenarbeiten,
}: {
  ich: string;
  startChats: Uebersicht[];
  startBlockiert: string[];
  gruppenarbeiten: { id: string; titel: string }[];
}) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const aktivId = searchParams.get("c");
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState(startChats);
  const [blockiert, setBlockiert] = useState(startBlockiert);
  const [dialog, setDialog] = useState<"chat" | "gruppe" | null>(null);
  const [suche, setSuche] = useState("");

  const neuLaden = useCallback(async () => {
    const { data } = await supabase.rpc("chat_uebersicht");
    if (data) setChats(data);
  }, [supabase]);

  // CHAT-05: Liste aktualisieren, sobald irgendwo eine Nachricht eintrifft
  useEffect(() => {
    const kanal = supabase
      .channel("chat-liste")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_nachricht" }, () => void neuLaden())
      .subscribe();
    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [supabase, neuLaden]);

  function oeffnen(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("c", id);
    else params.delete("c");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  async function nachAnlegen(id: string) {
    setDialog(null);
    await neuLaden();
    oeffnen(id);
  }

  const gelesen = useCallback(() => {
    setChats((l) => l.map((c) => (c.chat_id === aktivId ? { ...c, ungelesen: 0 } : c)));
    window.dispatchEvent(new Event(CHAT_GELESEN_EVENT));
  }, [aktivId]);

  async function blockieren(userId: string, blockieren: boolean) {
    if (blockieren && !window.confirm("Diese Person blockieren? Ihr könnt euch dann keine Direktnachrichten mehr schicken.")) return;
    const { error } = blockieren
      ? await supabase.from("nutzer_blockiert").insert({ user_id: ich, blockiert_id: userId })
      : await supabase.from("nutzer_blockiert").delete().eq("blockiert_id", userId);
    if (error) {
      window.alert("Das hat nicht geklappt.");
      fehlerMelden(error, { ort: "chat_blockieren" });
      return;
    }
    setBlockiert((l) => (blockieren ? [...l, userId] : l.filter((x) => x !== userId)));
    track(blockieren ? "chat_blockiert" : "chat_entblockt");
    void neuLaden();
  }

  async function verlassen() {
    if (!aktivId || !window.confirm("Gruppe verlassen?")) return;
    const { error } = await supabase.from("chat_mitglied").delete().eq("chat_id", aktivId).eq("user_id", ich);
    if (error) {
      window.alert("Verlassen hat nicht geklappt.");
      return;
    }
    track("chat_gruppe_verlassen");
    setChats((l) => l.filter((c) => c.chat_id !== aktivId));
    oeffnen(null);
  }

  const aktiv = chats.find((c) => c.chat_id === aktivId) ?? null;
  const q = suche.trim().toLowerCase();
  const sichtbar = chats.filter((c) => !q || (c.name ?? "").toLowerCase().includes(q));

  const knoepfe = (
    <>
      <button type="button" className="btng" onClick={() => setDialog("gruppe")}>
        + Neue Gruppe
      </button>
      <button type="button" className="btnp" onClick={() => setDialog("chat")}>
        + Neuer Chat
      </button>
    </>
  );

  return (
    <>
      <HubKopf titel="Chat" untertitel="Absprachen mit Kommilitonen – vor allem für Gruppenarbeiten." aktionen={knoepfe} />

      {chats.length === 0 ? (
        <LeererZustand
          icon="💬"
          text="Noch keine Chats. Schreib jemandem aus deinem Kurs oder lege eine Gruppe für eure Gruppenarbeit an."
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={() => setDialog("chat")}>
              + Ersten Chat starten
            </button>
          }
        />
      ) : (
        <div className="hub-zweispaltig chat-layout" data-ansicht={aktiv ? "inhalt" : "liste"}>
          <section className="card hub-liste" aria-label="Chats">
            <input type="search" className="field" placeholder="Chats durchsuchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            <ul className="chat-liste">
              {sichtbar.map((c) => (
                <li key={c.chat_id}>
                  <button type="button" className={`chat-listeneintrag ${c.chat_id === aktivId ? "aktiv" : ""}`} onClick={() => oeffnen(c.chat_id)}>
                    <span className="chat-avatar" aria-hidden>
                      {c.typ === "GRUPPE" ? "👥" : (c.name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="chat-listeneintrag-text">
                      <span className="rowb">
                        <strong>{c.typ === "DIREKT" ? `@${c.name}` : c.name}</strong>
                        <span className="faint chat-listen-zeit">{zeit(c.letzte_nachricht_am)}</span>
                      </span>
                      <span className="rowb">
                        <span className="muted chat-vorschau">
                          {c.partner_id && blockiert.includes(c.partner_id) ? "blockiert" : c.letzte_nachricht ?? "Noch keine Nachrichten"}
                        </span>
                        {c.ungelesen > 0 && (
                          <span className="chat-ungelesen" aria-label={`${c.ungelesen} ungelesen`}>
                            {c.ungelesen > 99 ? "99+" : c.ungelesen}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card hub-inhalt chat-inhalt" aria-label="Unterhaltung">
            {aktiv ? (
              <ChatVerlauf
                key={aktiv.chat_id}
                chat={aktiv}
                ich={ich}
                blockiert={blockiert}
                onBlockieren={blockieren}
                onZurueck={() => oeffnen(null)}
                onVerlassen={verlassen}
                onGelesen={gelesen}
              />
            ) : (
              <p className="empty-state hub-inhalt-leer">Wähle links einen Chat aus.</p>
            )}
          </section>
        </div>
      )}

      {dialog === "chat" && (
        <NeuerChatDialog
          onSchliessen={() => setDialog(null)}
          onWahl={async (n) => {
            const { data, error } = await supabase.rpc("chat_direkt_starten", { p_user_id: n.user_id });
            if (error) throw new Error(error.message);
            track("chat_gestartet", { typ: "DIREKT" });
            await nachAnlegen(data);
          }}
        />
      )}
      {dialog === "gruppe" && (
        <NeueGruppeDialog
          gruppenarbeiten={gruppenarbeiten}
          onSchliessen={() => setDialog(null)}
          onAnlegen={async (name, ids) => {
            const { data, error } = await supabase.rpc("chat_gruppe_erstellen", { p_name: name, p_user_ids: ids });
            if (error) throw new Error(error.message);
            track("chat_gestartet", { typ: "GRUPPE", mitglieder: ids.length + 1 });
            await nachAnlegen(data);
          }}
          onAusGruppenarbeit={async (deadlineId) => {
            const { data, error } = await supabase.rpc("chat_fuer_deadline", { p_deadline_id: deadlineId });
            if (error) throw new Error(error.message);
            track("chat_gestartet", { typ: "GRUPPENARBEIT" });
            await nachAnlegen(data);
          }}
        />
      )}
    </>
  );
}
