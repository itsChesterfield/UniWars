"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useFokusraum } from "@/lib/fokusraum-store";
import { useTimerZustand } from "@/lib/work-station/timer-store";
import { istFlow } from "@/lib/work-station/timer";
import { teilnehmerListe, type Anwesenheit, type Teilnehmer } from "@/lib/fokusraum";

// Teilnehmerliste des eigenen Raums für die Raum-Ansicht (dieselbe Verbindung, kein zweiter Kanal)
type EigeneListe = { topic: string; liste: Teilnehmer[] } | null;
let eigene: EigeneListe = null;
const LISTE_EREIGNIS = "universe-fokusraum-liste";
export function eigeneSetzen(wert: EigeneListe) {
  eigene = wert;
  window.dispatchEvent(new Event(LISTE_EREIGNIS));
}
export function useEigenerRaum(): EigeneListe {
  return useSyncExternalStore(
    (melden) => {
      window.addEventListener(LISTE_EREIGNIS, melden);
      return () => window.removeEventListener(LISTE_EREIGNIS, melden);
    },
    () => eigene,
    () => null,
  );
}

/**
 * Hält die Anwesenheit im beigetretenen Fokusraum aufrecht – auf jeder Seite, solange beigetreten.
 * Gezeigt wird nur, was freigegeben ist (Name, Fach) plus Timer-Stand. Kein Chat, keine Inhalte.
 */
export function FokusraumPraesenz({ name, faecher }: { name: string; faecher: { id: string; name: string }[] }) {
  const wahl = useFokusraum();
  const timer = useTimerZustand();
  const kanal = useRef<RealtimeChannel | null>(null);
  const bereit = useRef(false);
  /** Zuletzt gemeldeter Stand, damit ein frisch verbundener Kanal ihn sofort senden kann */
  const letzter = useRef<string | null>(null);

  const anwesenheit: Anwesenheit | null = wahl
    ? {
        n: wahl.nameZeigen ? name : null,
        f: wahl.fachZeigen ? (faecher.find((x) => x.id === timer?.fachId)?.name ?? null) : null,
        m: timer?.modus ?? "fokus",
        l: Boolean(timer?.laeuft),
        e: timer?.laeuft ? (timer && istFlow(timer) ? (timer.flowAb ?? null) : timer.endetUm) : null,
        r: timer?.restMs ?? 0,
        w: timer ? istFlow(timer) : false,
      }
    : null;
  const payload = anwesenheit ? JSON.stringify(anwesenheit) : null;

  // Kanal auf- und abbauen, wenn der Raum wechselt
  const topic = wahl?.topic ?? null;
  useEffect(() => {
    if (!topic) return;
    const supabase = createClient();
    let aus = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (aus || !data.user) return;
      await supabase.realtime.setAuth();
      // Raum inzwischen gewechselt oder Seite verlassen: keinen Kanal mehr öffnen
      if (aus) return;
      const ich = data.user.id;
      const k = supabase.channel(topic, { config: { private: true, presence: { key: ich } } });
      kanal.current = k;
      k.on("presence", { event: "sync" }, () => eigeneSetzen({ topic, liste: teilnehmerListe(k.presenceState<Anwesenheit>(), ich) }));
      k.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          bereit.current = true;
          if (letzter.current) void k.track(JSON.parse(letzter.current));
        }
      });
    })();
    return () => {
      aus = true;
      bereit.current = false;
      const k = kanal.current;
      kanal.current = null;
      eigeneSetzen(null);
      if (k) void supabase.removeChannel(k);
    };
  }, [topic]);

  // Stand mitteilen, wenn sich Timer oder Freigaben ändern
  useEffect(() => {
    letzter.current = payload;
    if (payload && bereit.current && kanal.current) void kanal.current.track(JSON.parse(payload));
  }, [payload]);

  return null;
}
