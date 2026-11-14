"use client";

import { Suspense, useState } from "react";
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

const WEITERE_HUBS: { name: string; icon: string; href?: string }[] = [
  {
    name: "Dateiablage",
    href: "/dateiablage",
    icon: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  },
  {
    name: "Notizen",
    href: "/notizen",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M9 13h6M9 16.5h4",
  },
  {
    name: "Karteikarten",
    href: "/karteikarten",
    icon: "rect:4,6,13,14,2|M8 3h9a2 2 0 0 1 2 2v11",
  },
  {
    name: "PDF Reader",
    href: "/pdf-reader",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M8.5 15.5h2v3M13 13.5h2v5M8.5 12.5h1.5",
  },
  {
    name: "Work Station",
    href: "/work-station",
    icon: "circle:12,13,7|M12 13V9.5M9.5 3.5h5M12 3.5V6",
  },
  {
    name: "MindMap",
    href: "/mindmap",
    icon: "circle:6,6,2.5|circle:18,7,2.5|circle:10,18,2.5|M8 7.5 15.5 8M8 16 9 9.5",
  },
  {
    name: "Whiteboard",
    href: "/whiteboard",
    icon: "rect:3,4,18,14,2|m8 21 4-3 4 3|M7 9h6M7 13h9",
  },
  {
    name: "Literaturverwaltung",
    href: "/literaturverwaltung",
    icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5Z|M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5Z",
  },
  {
    name: "Textverarbeitung",
    href: "/textverarbeitung",
    icon: "M5 7V5h14v2M12 5v14M9.5 19h5",
  },
  {
    name: "Präsentationen",
    href: "/praesentationen",
    icon: "rect:3,4,18,12,2|M12 16v3M8.5 21h7",
  },
  {
    name: "Tabellen",
    href: "/tabellen",
    icon: "rect:3.5,4.5,17,15,2|M3.5 9.5h17M9 9.5v10M3.5 14.5h17",
  },
  {
    name: "Transkription",
    href: "/transkription",
    icon: "rect:9,3,6,11,3|M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  },
  {
    name: "Assistent",
    href: "/assistent",
    icon: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z",
  },
  {
    name: "Chat",
    href: "/chat",
    icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-5 4Z",
  },
];

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
        <Link href="/" className={`navitem ${istAktiv("/") ? "active" : ""}`}>
          <NavIcon path="M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6" />
          Zentraler Hub
        </Link>
        {WEITERE_HUBS.map((hub) =>
          hub.href ? (
            <Link key={hub.name} href={hub.href} className={`navitem ${istAktiv(hub.href) ? "active" : ""}`}>
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
