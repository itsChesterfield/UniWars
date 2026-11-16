"use client";

import { Suspense, useState, type DragEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssistentStarter } from "@/components/assistent/assistent-starter";
import { Befehlspalette, befehleOeffnen } from "@/components/befehlspalette";
import { TimerWaechter } from "@/components/work-station/timer-waechter";
import { ChatPunkt } from "@/components/chat/chat-punkt";
import { ProfilAvatar } from "@/components/profil-avatar";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { useJetzt, useTimerZustand } from "@/lib/work-station/timer-store";
import { alsUhr, restzeit } from "@/lib/work-station/timer";
import { WEITERE_HUBS, ZENTRALER_HUB } from "@/lib/hubs/navigation";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import { HUB_DRAG_TYP } from "@/lib/geteilte-ansicht";
import { browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";

/** Gleicher Schlüssel wie im Skript in app/layout.tsx (setzt das Attribut vor dem ersten Zeichnen). */
export const SIDEBAR_SCHLUESSEL = "uniwars-sidebar-eingeklappt";

/** Hub-Icon an den Rand ziehen → geteilte Ansicht (siehe GeteilteAnsicht). */
function hubZiehen(e: DragEvent, href: string) {
  e.dataTransfer.setData(HUB_DRAG_TYP, href);
  e.dataTransfer.setData("text/uri-list", new URL(href, window.location.origin).toString());
  e.dataTransfer.effectAllowed = "copyLink";
}

function NavIcon({ path }: { path: string }) {
  const parts = path.split("|");
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {parts.map((part, i) => {
        if (part.startsWith("rect:")) {
          const [x, y, w, h, r] = part.slice(5).split(",").map(Number);
          return <rect key={i} x={x} y={y} width={w} height={h} rx={r} />;
        }
        if (part.startsWith("circle:")) {
          const [cx, cy, r] = part.slice(7).split(",").map(Number);
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        return <path key={i} d={part} />;
      })}
    </svg>
  );
}

function TimerRest() {
  const zustand = useTimerZustand();
  const jetzt = useJetzt(Boolean(zustand?.laeuft));
  if (!zustand || (!zustand.laeuft && zustand.restMs === zustand.dauerMs)) return null;
  return (
    <span className={`navitem-timer mono ${zustand.laeuft ? "" : "navitem-timer-pausiert"}`} title={zustand.laeuft ? "Timer läuft" : "Timer pausiert"}>
      {alsUhr(restzeit(zustand, jetzt))}
    </span>
  );
}

export function Sidebar({
  name,
  email,
  avatarUrl = null,
  streak,
  kiVerfuegbar = false,
}: {
  /** Anzeigename (Nutzername) */
  name: string;
  email: string;
  avatarUrl?: string | null;
  streak: number;
  /** KI-12: Mistral-Key gesetzt → schwebender ✨-Knopf (Strg+J) */
  kiVerfuegbar?: boolean;
}) {
  const pfad = usePathname();
  const [menueOffen, setMenueOffen] = useState(false);
  const eingeklappt = useBrowserWert(SIDEBAR_SCHLUESSEL, "0") === "1";

  function einklappenUmschalten() {
    const neu = !eingeklappt;
    document.documentElement.toggleAttribute("data-sidebar-eingeklappt", neu);
    browserWertSchreiben(SIDEBAR_SCHLUESSEL, neu ? "1" : null);
  }
  // Die Bereiche des Zentralen Hubs (Termine, Noten …) gehören zum Zentralen Hub
  const istAktiv = (href: string) =>
    href === "/" ? BEREICHE.some((b) => b.href === pfad) : pfad === href || pfad.startsWith(`${href}/`);

  return (
    <aside className="sidebar" data-menue-offen={menueOffen}>
      <TimerWaechter />
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
            <path d="M9 12.5l2 2 4-4.5" />
          </svg>
        </div>
        <div className="sidebar-brand-name">UniWars</div>
        <button
          type="button"
          className="sidebar-einklappen"
          aria-expanded={!eingeklappt}
          aria-label={eingeklappt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          title={eingeklappt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          onClick={einklappenUmschalten}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <path d="M9 4.5v15" />
            <path d={eingeklappt ? "m13 10 2 2-2 2" : "m15 10-2 2 2 2"} />
          </svg>
        </button>
        <button
          type="button"
          className="sidebar-menue-knopf"
          aria-expanded={menueOffen}
          aria-label={menueOffen ? "Menü schließen" : "Menü öffnen"}
          onClick={() => setMenueOffen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menueOffen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Strg/⌘+O: suchen, öffnen, erstellen (antippbar fürs Handy) */}
      <button
        type="button"
        className="sidebar-suche"
        onClick={() => {
          setMenueOffen(false);
          befehleOeffnen();
        }}
        title="Suchen, öffnen, erstellen (Strg+O)"
        aria-label="Suchen, öffnen, erstellen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <span className="sidebar-suche-text">Suchen</span>
        <span className="sidebar-suche-taste">
          <kbd>Strg</kbd>
          <kbd>O</kbd>
        </span>
      </button>

      <nav className="sidebar-nav" onClick={() => setMenueOffen(false)}>
        <Link href="/" className={`navitem ${istAktiv("/") ? "active" : ""}`} draggable onDragStart={(e) => hubZiehen(e, "/")}>
          <NavIcon path={ZENTRALER_HUB.icon} />
          <span className="navitem-text">{ZENTRALER_HUB.name}</span>
        </Link>
        {WEITERE_HUBS.map((hub) =>
          hub.href ? (
            <Link
              key={hub.name}
              href={hub.href}
              className={`navitem ${istAktiv(hub.href) ? "active" : ""}`}
              draggable
              title={`${hub.name} – zum Teilen des Bildschirms an den Rand ziehen`}
              onDragStart={(e) => hubZiehen(e, hub.href!)}
            >
              <NavIcon path={hub.icon} />
              <span className="navitem-text">{hub.name}</span>
              {hub.href === "/work-station" && <TimerRest />}
              {hub.href === "/chat" && <ChatPunkt />}
            </Link>
          ) : (
            <span key={hub.name} className="navitem disabled" title="Demnächst verfügbar">
              <NavIcon path={hub.icon} />
              {hub.name}
            </span>
          ),
        )}
      </nav>

      <div className="sidebar-footer">
        {streak > 0 && (
          <div className="streak-badge">
            🔥 {streak} {streak === 1 ? "Tag" : "Tage"}
          </div>
        )}

        {/* UniVerse Studio: kein KI-Knopf, nur der Hinweis aufs Tastenkürzel (antippbar fürs Handy) */}
        {kiVerfuegbar && (
          <button type="button" className="studio-hinweis" onClick={() => studioOeffnen()} title="UniVerse Studio öffnen">
            <span>✨ UniVerse Studio</span>
            <span className="studio-hinweis-taste">
              <kbd>Strg</kbd>
              <kbd>J</kbd>
            </span>
          </button>
        )}

        {/* Profil → Einstellungen (Name, Bild, Konto, Design, KI, Abmelden) */}
        <Link
          href="/einstellungen"
          className={`sidebar-profil ${pfad === "/einstellungen" ? "active" : ""}`}
          title="Profil und Einstellungen"
          onClick={() => setMenueOffen(false)}
        >
          <ProfilAvatar name={name} url={avatarUrl} groesse={34} />
          <span className="sidebar-profil-text">
            <span className="sidebar-profil-name">{name}</span>
            <span className="sidebar-profil-mail">{email}</span>
          </span>
          <svg className="sidebar-profil-zahnrad" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </Link>
      </div>
      {kiVerfuegbar && (
        <Suspense fallback={null}>
          <AssistentStarter />
        </Suspense>
      )}
      <Befehlspalette kiVerfuegbar={kiVerfuegbar} />
    </aside>
  );
}
