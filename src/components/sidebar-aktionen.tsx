"use client";

import { logout } from "@/app/logout/actions";
import { setTheme } from "@/app/settings/actions";
import { abmelden, track } from "@/lib/analytics";
import type { Enums } from "@/lib/supabase/types";

export function ThemeUmschalter({ theme }: { theme: Enums<"theme"> }) {
  const naechstesTheme: Enums<"theme"> = theme === "DUNKEL" ? "HELL" : "DUNKEL";

  return (
    <form action={setTheme.bind(null, naechstesTheme)}>
      <button
        type="submit"
        className="sidebar-theme-toggle"
        onClick={() => track("theme_gewechselt", { theme: naechstesTheme })}
      >
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
  );
}

export function AbmeldenButton() {
  return (
    <form action={logout}>
      <button type="submit" className="sidebar-logout" onClick={() => abmelden()}>
        Abmelden
      </button>
    </form>
  );
}
