"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { NotificationBell } from "@/components/notification-bell";
import { ProfilAvatar } from "@/components/profil-avatar";
import { befehleOeffnen } from "@/components/befehlspalette";
import { hubAusPfad } from "@/lib/hubs/navigation";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { useJetzt, useTimerZustand } from "@/lib/work-station/timer-store";
import { alsUhr, restzeit } from "@/lib/work-station/timer";
import type { Tables } from "@/lib/supabase/types";
import { useOnline } from "@/lib/online";

/** Fokus-Timer als Pille, solange er läuft oder pausiert ist – führt zur Work Station. */
function FokusStatus() {
  const zustand = useTimerZustand();
  const jetzt = useJetzt(Boolean(zustand?.laeuft));
  if (!zustand || (!zustand.laeuft && zustand.restMs === zustand.dauerMs)) return null;
  return (
    <Link href="/work-station" className="timerstatus" data-pausiert={zustand.laeuft ? undefined : ""}>
      <span className="vh">{zustand.laeuft ? "Fokus läuft, noch" : "Fokus pausiert, noch"}</span>
      <span className="zahl">{alsUhr(restzeit(zustand, jetzt))}</span>
    </Link>
  );
}

/** Datum erst im Browser setzen, damit Server und Browser nicht auseinanderlaufen. */
function Heute() {
  const [text, setText] = useState("");
  useEffect(() => {
    const setzen = () =>
      setText(new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    setzen();
    const id = window.setInterval(setzen, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="heute">{text}</span>;
}

/**
 * Design B3: Kopfleiste über der Arbeitsfläche (DESIGN.md Abschnitt 4).
 * Links der Ort, rechts Suche, Fokus-Timer, Lernserie, Benachrichtigungen und Datum.
 * Am Handy kommen UniVerse Studio und das Profil dazu, weil die Symbolleiste dort fehlt.
 */
export function Kopfleiste({
  name,
  avatarUrl = null,
  streak = 0,
  kiVerfuegbar = false,
  benachrichtigungen,
  einladungen,
}: {
  name: string;
  avatarUrl?: string | null;
  streak?: number;
  kiVerfuegbar?: boolean;
  benachrichtigungen: Tables<"benachrichtigung">[];
  einladungen: Tables<"einladung">[];
}) {
  const pfad = usePathname();
  const online = useOnline();
  const { hub, unterseite } = hubAusPfad(pfad);
  const titel = hub?.name ?? (pfad.startsWith("/einstellungen") ? "Einstellungen" : "UniVerse");

  return (
    <header className="kopfleiste">
      <div className="pfad">
        {hub && <NavIcon path={hub.icon} groesse={16} />}
        {unterseite ? (
          <>
            <Link href="/" className="pfad-zurueck">
              {titel}
            </Link>
            <span className="pfad-trenn" aria-hidden>
              /
            </span>
            <span>{unterseite}</span>
          </>
        ) : (
          <span>{titel}</span>
        )}
      </div>

      <button type="button" className="suchpille" onClick={() => befehleOeffnen()} aria-label="Suchen, öffnen, erstellen (Strg+O)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <span className="suchpille-text">Suchen</span>
        <kbd>Strg</kbd>
        <kbd>O</kbd>
      </button>

      <div className="status">
        {!online && (
          <span className="offline" role="status" title="Änderungen an Notizen und Aufgaben brauchen eine Verbindung. Studio, Chat und Transkription warten, bis du wieder online bist.">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3l18 18" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6" />
            </svg>
            Offline
          </span>
        )}
        <FokusStatus />
        {streak > 0 && (
          <span className="serie" title="Lernserie">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.5-5.4 3.6-8.3.4 1.6 1.4 2.8 2.6 3.3.2-2.6 1.4-5 3.3-6.8-.2 3 1.2 4.4 2.3 6.1.8 1.3 1.2 2.6 1.2 4 0 4.6-2.8 7.9-6.5 7.9Z" />
            </svg>
            <span className="zahl">{streak}</span>
            <span className="serie-text">{streak === 1 ? "Tag" : "Tage"}</span>
          </span>
        )}
        <NotificationBell initial={benachrichtigungen} initialEinladungen={einladungen} />
        <span className="trenn" aria-hidden />
        <Heute />
      </div>

      {kiVerfuegbar && (
        <button type="button" className="symbolknopf nur-mobil" aria-label="UniVerse Studio" onClick={() => studioOeffnen()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8Z" />
            <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
          </svg>
        </button>
      )}
      <Link href="/einstellungen" className="nur-mobil kopf-profil" aria-label={`Profil und Einstellungen, ${name}`}>
        <ProfilAvatar name={name} url={avatarUrl} groesse={28} />
      </Link>
      <span className="ladespur" aria-hidden>
        <i />
      </span>
    </header>
  );
}
