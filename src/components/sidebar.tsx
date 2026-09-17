import Link from "next/link";
import { logout } from "@/app/logout/actions";
import { setTheme } from "@/app/settings/actions";
import type { Enums } from "@/lib/supabase/types";

const WEITERE_HUBS = [
  {
    name: "Dateiablage",
    icon: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  },
  {
    name: "Notizen",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M9 13h6M9 16.5h4",
  },
  {
    name: "Karteikarten",
    icon: "rect:4,6,13,14,2|M8 3h9a2 2 0 0 1 2 2v11",
  },
  {
    name: "PDF Reader",
    icon: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z|M14 3v5h5|M8.5 15.5h2v3M13 13.5h2v5M8.5 12.5h1.5",
  },
  {
    name: "Work Station",
    icon: "circle:12,13,7|M12 13V9.5M9.5 3.5h5M12 3.5V6",
  },
  {
    name: "MindMap",
    icon: "circle:6,6,2.5|circle:18,7,2.5|circle:10,18,2.5|M8 7.5 15.5 8M8 16 9 9.5",
  },
  {
    name: "Whiteboard",
    icon: "rect:3,4,18,14,2|m8 21 4-3 4 3|M7 9h6M7 13h9",
  },
  {
    name: "Literaturverwaltung",
    icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5Z|M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5Z",
  },
  {
    name: "Textverarbeitung",
    icon: "M5 7V5h14v2M12 5v14M9.5 19h5",
  },
  {
    name: "Präsentationen",
    icon: "rect:3,4,18,12,2|M12 16v3M8.5 21h7",
  },
  {
    name: "Tabellen",
    icon: "rect:3.5,4.5,17,15,2|M3.5 9.5h17M9 9.5v10M3.5 14.5h17",
  },
  {
    name: "Transkription",
    icon: "rect:9,3,6,11,3|M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  },
  {
    name: "Chat",
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

export function Sidebar({
  email,
  theme,
  streak,
}: {
  email: string;
  theme: Enums<"theme">;
  streak: number;
}) {
  const naechstesTheme: Enums<"theme"> = theme === "DUNKEL" ? "HELL" : "DUNKEL";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V6l8-3 8 3v13" />
            <path d="M9 19v-6h6v6" />
          </svg>
        </div>
        <div className="sidebar-brand-name">UniWars</div>
      </div>

      <nav className="sidebar-nav">
        <Link href="/" className="navitem active">
          <NavIcon path="M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6" />
          Zentraler Hub
        </Link>
        {WEITERE_HUBS.map((hub) => (
          <span key={hub.name} className="navitem disabled" title="Demnächst verfügbar">
            <NavIcon path={hub.icon} />
            {hub.name}
          </span>
        ))}
      </nav>

      <div className="sidebar-footer">
        {streak > 0 && (
          <div className="streak-badge">
            🔥 {streak} {streak === 1 ? "Tag" : "Tage"}
          </div>
        )}

        <span className="sidebar-user">{email}</span>

        <form action={setTheme.bind(null, naechstesTheme)}>
          <button type="submit" className="sidebar-theme-toggle">
            <span className="row" style={{ gap: 9 }}>
              {theme === "DUNKEL" ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 13A8.5 8.5 0 1 1 11 3a6.5 6.5 0 0 0 10 10Z" />
                </svg>
              )}
              <span>Darstellung</span>
            </span>
            <span style={{ color: "var(--accent-strong)" }}>{theme === "DUNKEL" ? "Hell" : "Dunkel"}</span>
          </button>
        </form>

        <form action={logout}>
          <button type="submit" className="sidebar-logout">
            Abmelden
          </button>
        </form>
      </div>
    </aside>
  );
}
