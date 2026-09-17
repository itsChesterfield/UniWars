import { logout } from "@/app/logout/actions";
import { setTheme } from "@/app/settings/actions";
import type { Enums } from "@/lib/supabase/types";

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
      <div className="sidebar-brand">UniWars</div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-active">Übersicht</span>
        {/* Weitere Hubs (Notizen, Karteikarten, …) kommen hier additiv dazu */}
      </nav>

      {streak > 0 && <div className="streak-badge">🔥 {streak} Tage</div>}

      <div className="sidebar-footer">
        <span className="sidebar-user">{email}</span>
        <form action={setTheme.bind(null, naechstesTheme)}>
          <button type="submit" className="sidebar-theme-toggle">
            {theme === "DUNKEL" ? "☀️ Hell" : "🌙 Dunkel"}
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
