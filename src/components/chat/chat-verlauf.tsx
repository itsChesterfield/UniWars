"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DreiPunkteMenue, type MenuePunkt } from "@/components/hubs/drei-punkte-menue";
import { AnhangDialog, type AnhangWahl, type Nutzer } from "@/components/chat/chat-dialoge";
import type { Json, Tables } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";

type Nachricht = Tables<"chat_nachricht">;
type Anhang = { typ: "datei" | "deadline" | "todo"; id: string; titel: string; mime?: string; faellig_am?: string | null };

export const MAX_ZEICHEN = 2000;
const LADE_ANZAHL = 200;

export type ChatKopf = { chat_id: string; typ: string; name: string | null; partner_id: string | null; mitglieder: number };

function uhrzeit(iso: string) {
  const d = new Date(iso);
  const heute = new Date();
  const zeit = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === heute.toDateString() ? zeit : `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${zeit}`;
}

function sortieren(liste: Nachricht[]) {
  return [...liste].sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am));
}

function fehlerText(err: unknown): string {
  const m = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  if (m.includes("BLOCKIERT")) return "Du kannst dieser Person keine Nachrichten senden.";
  if (m.includes("ZU_LANG")) return `Maximal ${MAX_ZEICHEN} Zeichen.`;
  if (m.includes("KEIN_MITGLIED")) return "Du bist nicht mehr Mitglied dieses Chats.";
  return "Nachricht konnte nicht gesendet werden.";
}

export function ChatVerlauf({
  chat,
  ich,
  blockiert,
  onBlockieren,
  onZurueck,
  onVerlassen,
  onGelesen,
}: {
  chat: ChatKopf;
  ich: string;
  blockiert: string[];
  onBlockieren: (userId: string, blockieren: boolean) => Promise<void>;
  onZurueck: () => void;
  onVerlassen: () => Promise<void>;
  onGelesen: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [nachrichten, setNachrichten] = useState<Nachricht[] | null>(null);
  const [mitglieder, setMitglieder] = useState<Nutzer[]>([]);
  const [text, setText] = useState("");
  const [anhang, setAnhang] = useState<AnhangWahl | null>(null);
  const [anhangDialog, setAnhangDialog] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const liste = useRef<HTMLDivElement>(null);
  const amEnde = useRef(true);

  const gelesen = useCallback(() => {
    void supabase.rpc("chat_gelesen", { p_chat_id: chat.chat_id }).then(() => onGelesen());
  }, [supabase, chat.chat_id, onGelesen]);

  // Laden + CHAT-03 Echtzeit
  useEffect(() => {
    let aktiv = true;
    (async () => {
      const [{ data, error }, { data: m }] = await Promise.all([
        supabase.from("chat_nachricht").select("*").eq("chat_id", chat.chat_id).order("erstellt_am", { ascending: false }).limit(LADE_ANZAHL),
        supabase.rpc("chat_mitglieder", { p_chat_id: chat.chat_id }),
      ]);
      if (!aktiv) return;
      if (error) fehlerMelden(error, { ort: "chat_laden" });
      setNachrichten(sortieren(data ?? []));
      setMitglieder((m ?? []) as Nutzer[]);
      gelesen();
    })();

    const kanal = supabase
      .channel(`chat-${chat.chat_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_nachricht", filter: `chat_id=eq.${chat.chat_id}` },
        (payload) => {
          const neu = payload.new as Nachricht;
          if (!neu?.id) return;
          setNachrichten((l) => sortieren([...(l ?? []).filter((x) => x.id !== neu.id), neu]));
          if (payload.eventType === "INSERT" && neu.user_id !== ich) gelesen();
        },
      )
      .subscribe();
    return () => {
      aktiv = false;
      void supabase.removeChannel(kanal);
    };
  }, [supabase, chat.chat_id, ich, gelesen]);

  // Neue Nachrichten: nach unten scrollen, wenn man schon unten war
  useEffect(() => {
    const el = liste.current;
    if (el && amEnde.current) el.scrollTop = el.scrollHeight;
  }, [nachrichten]);

  const namen = useMemo(() => new Map(mitglieder.map((m) => [m.user_id, m.username])), [mitglieder]);
  const partnerBlockiert = chat.typ === "DIREKT" && chat.partner_id ? blockiert.includes(chat.partner_id) : false;

  async function senden() {
    const inhalt = text.trimEnd();
    if ((!inhalt.trim() && !anhang) || sendet) return;
    if (inhalt.length > MAX_ZEICHEN) {
      setFehler(`Maximal ${MAX_ZEICHEN} Zeichen.`);
      return;
    }
    setSendet(true);
    setFehler(null);
    const { data, error } = await supabase.rpc("nachricht_senden", {
      p_chat_id: chat.chat_id,
      p_text: inhalt,
      ...(anhang ? { p_anhang_typ: anhang.typ, p_anhang_id: anhang.id } : {}),
    });
    setSendet(false);
    if (error) {
      setFehler(fehlerText(error));
      fehlerMelden(error, { ort: "chat_senden" });
      return;
    }
    if (data) setNachrichten((l) => sortieren([...(l ?? []).filter((x) => x.id !== data.id), data as Nachricht]));
    amEnde.current = true;
    track("chat_nachricht_gesendet", { typ: chat.typ, mit_anhang: Boolean(anhang), zeichen: inhalt.length });
    setText("");
    setAnhang(null);
  }

  async function loeschen(n: Nachricht) {
    if (!window.confirm("Nachricht löschen? Sie wird für alle durch „Nachricht gelöscht“ ersetzt.")) return;
    const { error } = await supabase.rpc("nachricht_loeschen", { p_id: n.id });
    if (error) {
      setFehler("Löschen hat nicht geklappt.");
      return;
    }
    setNachrichten((l) => (l ?? []).map((x) => (x.id === n.id ? { ...x, geloescht: true, text: "", anhang: null } : x)));
    track("chat_nachricht_geloescht");
  }

  async function melden(userId: string) {
    const grund = window.prompt("Warum meldest du diese Person? (z. B. Belästigung, Spam)")?.trim();
    if (!grund) return;
    const { error } = await supabase.from("chat_meldung").insert({ gemeldet_user_id: userId, chat_id: chat.chat_id, grund: grund.slice(0, 1000), von_user_id: ich });
    window.alert(error ? "Meldung konnte nicht gesendet werden." : "Danke, die Meldung ist eingegangen.");
    if (!error) track("chat_gemeldet");
  }

  const kopfMenue: MenuePunkt[] = [];
  if (chat.typ === "DIREKT" && chat.partner_id) {
    const pid = chat.partner_id;
    kopfMenue.push(
      partnerBlockiert
        ? { label: "Blockierung aufheben", onClick: () => void onBlockieren(pid, false) }
        : { label: "Nutzer blockieren", onClick: () => void onBlockieren(pid, true), gefahr: true },
      { label: "Nutzer melden", onClick: () => void melden(pid), gefahr: true },
    );
  } else {
    kopfMenue.push({ label: "Gruppe verlassen", onClick: () => void onVerlassen(), gefahr: true });
  }

  return (
    <div className="chat-verlauf">
      <header className="chat-kopf">
        <button type="button" className="btng hub-zurueck" onClick={onZurueck}>
          ←
        </button>
        <span className="chat-avatar" aria-hidden>
          {chat.typ === "GRUPPE" ? "👥" : (chat.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="chat-kopf-text">
          <strong>{chat.typ === "DIREKT" ? `@${chat.name}` : chat.name}</strong>
          <span className="muted">
            {chat.typ === "GRUPPE" ? mitglieder.map((m) => (m.user_id === ich ? "du" : `@${m.username}`)).join(", ") || `${chat.mitglieder} Mitglieder` : partnerBlockiert ? "blockiert" : "Direktnachricht"}
          </span>
        </div>
        <DreiPunkteMenue punkte={kopfMenue} label="Chat-Optionen" />
      </header>

      <div
        className="chat-nachrichten"
        ref={liste}
        onScroll={(e) => {
          const el = e.currentTarget;
          amEnde.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        aria-live="polite"
      >
        {nachrichten === null && <p className="empty-state chat-mitte">Lädt …</p>}
        {nachrichten?.length === 0 && <p className="empty-state chat-mitte">Noch keine Nachrichten. Schreib die erste!</p>}
        {nachrichten?.map((n, i) => {
          const eigen = n.user_id === ich;
          const absenderBlockiert = !eigen && n.user_id !== null && blockiert.includes(n.user_id);
          const vorher = nachrichten[i - 1];
          const zeigeName = chat.typ === "GRUPPE" && !eigen && vorher?.user_id !== n.user_id;
          const a = n.anhang as Anhang | null;
          const menue: MenuePunkt[] = eigen
            ? n.geloescht
              ? []
              : [{ label: "Löschen", onClick: () => void loeschen(n), gefahr: true }]
            : n.user_id
              ? [
                  { label: "Nutzer melden", onClick: () => void melden(n.user_id as string), gefahr: true },
                  ...(chat.typ === "GRUPPE" && !absenderBlockiert
                    ? [{ label: "Nutzer blockieren", onClick: () => void onBlockieren(n.user_id as string, true), gefahr: true }]
                    : []),
                ]
              : [];
          return (
            <div key={n.id} className={`chat-zeile ${eigen ? "eigen" : "fremd"}`}>
              {zeigeName && <span className="chat-absender">@{namen.get(n.user_id ?? "") ?? "Unbekannt"}</span>}
              <div className="chat-blase-zeile">
                <div className={`chat-blase ${n.geloescht || absenderBlockiert ? "geloescht" : ""}`}>
                  {n.geloescht ? (
                    <em>Nachricht gelöscht</em>
                  ) : absenderBlockiert ? (
                    <em>Nachricht von blockierter Person ausgeblendet</em>
                  ) : (
                    <>
                      {a && <AnhangKarte nachrichtId={n.id} anhang={a} />}
                      {n.text && <span className="chat-text">{n.text}</span>}
                    </>
                  )}
                  <time className="chat-zeit" dateTime={n.erstellt_am}>
                    {uhrzeit(n.erstellt_am)}
                  </time>
                </div>
                {menue.length > 0 && <DreiPunkteMenue punkte={menue} label="Nachricht-Optionen" />}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="chat-eingabe">
        {fehler && (
          <p className="auth-error" role="alert">
            {fehler}
          </p>
        )}
        {partnerBlockiert ? (
          <p className="muted chat-mitte">Du hast diese Person blockiert. Hebe die Blockierung im Menü oben auf, um wieder zu schreiben.</p>
        ) : (
          <>
            {anhang && (
              <div className="chat-anhang-vorschau">
                <span>
                  {anhang.typ === "datei" ? "📎" : anhang.typ === "deadline" ? "⏰" : "☑"} {anhang.titel}
                </span>
                <button type="button" className="icon-knopf" aria-label="Anhang entfernen" onClick={() => setAnhang(null)}>
                  ✕
                </button>
              </div>
            )}
            <div className="chat-eingabe-zeile">
              <button type="button" className="icon-knopf chat-buroklammer" aria-label="Anhängen" title="Datei, Deadline oder To-do anhängen" onClick={() => setAnhangDialog(true)}>
                📎
              </button>
              <textarea
                className="field chat-textfeld"
                rows={1}
                value={text}
                maxLength={MAX_ZEICHEN}
                placeholder="Nachricht schreiben … (Enter sendet, Shift+Enter neue Zeile)"
                aria-label="Nachricht"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void senden();
                  }
                }}
              />
              <button type="button" className="btnp" onClick={() => void senden()} disabled={sendet || (!text.trim() && !anhang)}>
                Senden
              </button>
            </div>
            {text.length > MAX_ZEICHEN - 200 && (
              <span className={`chat-zaehler ${text.length >= MAX_ZEICHEN ? "voll" : ""}`}>
                {text.length} / {MAX_ZEICHEN}
              </span>
            )}
          </>
        )}
      </footer>

      {anhangDialog && (
        <AnhangDialog
          onSchliessen={() => setAnhangDialog(false)}
          onWahl={(a) => {
            setAnhang(a);
            setAnhangDialog(false);
          }}
        />
      )}
    </div>
  );
}

function AnhangKarte({ nachrichtId, anhang }: { nachrichtId: string; anhang: Anhang }) {
  if (anhang.typ === "datei") {
    return (
      <a className="chat-karte" href={`/chat/anhang/${nachrichtId}`} target="_blank" rel="noopener noreferrer">
        <span aria-hidden>{anhang.mime?.startsWith("image/") ? "🖼️" : anhang.mime === "application/pdf" ? "📕" : "📎"}</span>
        <span>
          <strong>{anhang.titel}</strong>
          <span className="muted">Datei öffnen</span>
        </span>
      </a>
    );
  }
  return (
    <div className="chat-karte">
      <span aria-hidden>{anhang.typ === "deadline" ? "⏰" : "☑"}</span>
      <span>
        <strong>{anhang.titel}</strong>
        <span className="muted">
          {anhang.typ === "deadline" ? "Deadline" : "To-do"}
          {anhang.faellig_am ? ` · fällig ${new Date(anhang.faellig_am).toLocaleDateString("de-DE")}` : ""}
        </span>
      </span>
    </div>
  );
}

export type { Json };
