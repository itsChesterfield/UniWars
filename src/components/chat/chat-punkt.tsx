"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const CHAT_GELESEN_EVENT = "uniwars:chat-gelesen";

/** CHAT-05: Punkt am Chat-Eintrag in der Sidebar. */
export function ChatPunkt() {
  const [anzahl, setAnzahl] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    let aktiv = true;
    const laden = async () => {
      const { data, error } = await supabase.rpc("chat_ungelesen_gesamt");
      if (aktiv && !error && typeof data === "number") setAnzahl(data);
    };
    void laden();
    const kanal = supabase
      .channel("chat-punkt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_nachricht" }, () => void laden())
      .subscribe();
    const neu = () => void laden();
    window.addEventListener(CHAT_GELESEN_EVENT, neu);
    const intervall = window.setInterval(laden, 120_000);
    return () => {
      aktiv = false;
      window.removeEventListener(CHAT_GELESEN_EVENT, neu);
      window.clearInterval(intervall);
      void supabase.removeChannel(kanal);
    };
  }, []);
  if (anzahl === 0) return null;
  return <span className="navitem-punkt" aria-label={`${anzahl} ungelesene Nachrichten`} />;
}
