"use client";

import { Suspense, useState, type DragEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AbmeldenButton, ThemeUmschalter } from "@/components/sidebar-aktionen";
import { AnalyticsEinstellung } from "@/components/analytics-einstellung";
import { KiEinstellung } from "@/components/ki/ki-einstellung";
import { AssistentStarter } from "@/components/assistent/assistent-starter";
import { KiVerlaufLoeschen } from "@/components/assistent/ki-verlauf-loeschen";
import { KiKontingentAnzeige } from "@/components/ki/ki-kontingent-anzeige";
import type { Enums } from "@/lib/supabase/types";
import { TimerWaechter } from "@/components/work-station/timer-waechter";
import { ChatPunkt } from "@/components/chat/chat-punkt";
import { useJetzt, useTimerZustand } from "@/lib/work-station/timer-store";
import { alsUhr, restzeit } from "@/lib/work-station/timer";
import { WEITERE_HUBS, ZENTRALER_HUB } from "@/lib/hubs/navigation";
import { HUB_DRAG_TYP } from "@/lib/geteilte-ansicht";

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
  email,
  theme,
  streak,
  kiEingewilligt = false,
  audioEingewilligt = false,
  kiVerfuegbar = false,
}: {
  email: string;
  theme: Enums<"theme">;
  streak: number;
  /** KI-D1: settings.ki_einwilligung gesetzt? */
  kiEingewilligt?: boolean;
  /** KI-D2: settings.ki_audio_einwilligung gesetzt? */
  audioEingewilligt?: boolean;
  /** KI-12: Mistral-Key gesetzt → schwebender ✨-Knopf (Strg+J) */
  kiVerfuegbar?: boolean;
}) {
  const pfad = usePathname();
  const [menueOffen, setMenueOffen] = useState(false);
  const istAktiv = (href: string) => (href === "/" ? pfad === "/" : pfad === href || pfad.startsWith(`${href}/`));

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

      <nav className="sidebar-nav" onClick={() => setMenueOffen(false)}>
        <Link href="/" className={`navitem ${istAktiv("/") ? "active" : ""}`} draggable onDragStart={(e) => hubZiehen(e, "/")}>
          <NavIcon path={ZENTRALER_HUB.icon} />
          {ZENTRALER_HUB.name}
        </Link>
        {WEITERE_HUBS.map((hub) =>
          hub.href ? (
            <Link
              key={hub.name}
              href={hub.href}
              className={`navitem ${istAktiv(hub.href) ? "active" : ""}`}
              draggable
              title="Zum Teilen des Bildschirms an den Rand ziehen"
              onDragStart={(e) => hubZiehen(e, hub.href!)}
            >
              <NavIcon path={hub.icon} />
              {hub.name}
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

        <span className="sidebar-user">{email}</span>

        <ThemeUmschalter theme={theme} />
        <AnalyticsEinstellung />
        <KiEinstellung startEingewilligt={kiEingewilligt} />
        <KiEinstellung art="audio" startEingewilligt={audioEingewilligt} />
        {/* auch nach einem Widerruf: Löschen muss immer möglich sein */}
        {kiVerfuegbar && <KiVerlaufLoeschen />}
        {kiEingewilligt && <KiKontingentAnzeige />}
        <AbmeldenButton />
      </div>
      {kiVerfuegbar && (
        <Suspense fallback={null}>
          <AssistentStarter />
        </Suspense>
      )}
    </aside>
  );
}
