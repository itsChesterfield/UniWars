"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bereichskopf, kurzTitel } from "@/components/hubs/bereichskopf";
import { Zustand } from "@/components/zustand";
import { NeueGruppeDialog, NeuerChatDialog } from "@/components/chat/chat-dialoge";
import { ChatVerlauf } from "@/components/chat/chat-verlauf";
import { CHAT_GELESEN_EVENT } from "@/components/chat/chat-punkt";
import type { Database } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";
import { OfflineHinweis } from "@/components/offline-hinweis";
import { Icon } from "@/components/nav-icon";
import { rueckfrage } from "@/components/rueckfrage";
import { meldung } from "@/components/meldung";

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
    if (blockieren && !(await rueckfrage({ titel: "Diese Person blockieren?", text: "Ihr könnt euch dann keine Direktnachrichten mehr schicken.", ja: "Blockieren", gefahr: true }))) return;
    const { error } = blockieren
      ? await supabase.from("nutzer_blockiert").insert({ user_id: ich, blockiert_id: userId })
      : await supabase.from("nutzer_blockiert").delete().eq("blockiert_id", userId);
    if (error) {
      meldung("Das hat nicht geklappt.");
      fehlerMelden(error, { ort: "chat_blockieren" });
      return;
    }
    setBlockiert((l) => (blockieren ? [...l, userId] : l.filter((x) => x !== userId)));
    track(blockieren ? "chat_blockiert" : "chat_entblockt");
    void neuLaden();
  }

  async function verlassen() {
    if (!aktivId || !(await rueckfrage({ titel: "Gruppe verlassen?", text: "Du siehst die Nachrichten der Gruppe dann nicht mehr.", ja: "Verlassen", gefahr: true }))) return;
    const { error } = await supabase.from("chat_mitglied").delete().eq("chat_id", aktivId).eq("user_id", ich);
    if (error) {
      meldung("Verlassen hat nicht geklappt.");
      return;
    }
    track("chat_gruppe_verlassen");
    setChats((l) => l.filter((c) => c.chat_id !== aktivId));
    oeffnen(null);
  }

  const aktiv = chats.find((c) => c.chat_id === aktivId) ?? null;
  const q = suche.trim().toLowerCase();
  const sichtbar = chats.filter((c) => !q || (c.name ?? "").toLowerCase().includes(q));

  const ungelesen = chats.reduce((summe, c) => summe + (c.ungelesen ?? 0), 0);
  const zuletzt = chats.length ? [...chats].sort((x, y) => y.letzte_nachricht_am.localeCompare(x.letzte_nachricht_am))[0] : null;
  const chatName = (c: Uebersicht) => (c.typ === "DIREKT" ? `@${c.name}` : (c.name ?? "Gruppe"));

  const knoepfe = (
    <>
      <button type="button" className="knopf neben" onClick={() => setDialog("gruppe")}>
        <Icon name="gruppe" groesse={16} />
        Neue Gruppe
      </button>
      <button type="button" className="knopf haupt" onClick={() => setDialog("chat")}>
        <Icon name="plus" groesse={16} />
        Neuer Chat
      </button>
    </>
  );

  return (
    <>
      <Bereichskopf
        titel="Chat"
        untertitel="Absprachen mit Kommilitonen, vor allem für Gruppenarbeiten."
        {...(zuletzt
          ? {
              zahl: ungelesen,
              einheit: "ungelesen",
              lage: { text: `Zuletzt: ${kurzTitel(chatName(zuletzt), 36)}.`, betont: kurzTitel(chatName(zuletzt), 36).split(" ") },
            }
          : {})}
        aktionen={chats.length > 0 ? knoepfe : undefined}
      />
      <OfflineHinweis text="Offline. Neue Nachrichten senden und empfangen geht wieder, sobald du online bist." />

      {chats.length === 0 ? (
        <Zustand
          art="leer"
          icon="chat"
          titel="Noch keine Chats."
          aktion={
            <button type="button" className="knopf neben klein" onClick={() => setDialog("chat")}>
              <Icon name="plus" groesse={16} />
              Ersten Chat starten
            </button>
          }
        >
          Schreib jemandem aus deinem Kurs oder lege eine Gruppe für eure Gruppenarbeit an.
        </Zustand>
      ) : (
        <div className="chat-layout" data-ansicht={aktiv ? "inhalt" : "liste"}>
          <section className="chat-spalte" aria-label="Chats">
            <input type="search" className="chat-suche" aria-label="Chats durchsuchen" placeholder="Chats durchsuchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            {sichtbar.length === 0 ? (
              <Zustand
                art="leer"
                icon="suchen"
                titel="Kein Chat heißt so."
                region
                ebene={3}
                aktion={
                  <button type="button" className="knopf neben klein" onClick={() => setSuche("")}>
                    Suche zurücksetzen
                  </button>
                }
              />
            ) : (
              <ul className="chat-liste">
                {sichtbar.map((c) => (
                  <li key={c.chat_id}>
                    <button type="button" className="chat-listeneintrag" aria-current={c.chat_id === aktivId ? "true" : undefined} onClick={() => oeffnen(c.chat_id)}>
                      <span className="chat-avatar" aria-hidden>
                        {c.typ === "GRUPPE" ? <Icon name="gruppe" groesse={18} /> : (c.name ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="chat-eintrag-name">{chatName(c)}</span>
                      <span className="chat-eintrag-zeit zahl">{zeit(c.letzte_nachricht_am)}</span>
                      <span className="chat-vorschau">
                        {c.partner_id && blockiert.includes(c.partner_id) ? "blockiert" : c.letzte_nachricht ?? "Noch keine Nachrichten"}
                      </span>
                      {c.ungelesen > 0 && (
                        <span className="chat-ungelesen zahl">
                          {c.ungelesen > 99 ? "99+" : c.ungelesen}
                          <span className="vh"> ungelesen</span>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="chat-inhalt" aria-label="Unterhaltung">
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
              <p className="chat-mitte">Wähle links einen Chat aus.</p>
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
