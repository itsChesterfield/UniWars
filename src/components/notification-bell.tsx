"use client";

import { useState, useTransition } from "react";
import { markiereBenachrichtigungGelesen } from "@/app/benachrichtigung/actions";
import type { Tables } from "@/lib/supabase/types";

type Benachrichtigung = Tables<"benachrichtigung">;

export function NotificationBell({ initial }: { initial: Benachrichtigung[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const ungelesen = items.filter((n) => !n.gelesen).length;

  function markiereGelesen(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, gelesen: true } : n)));
    startTransition(() => markiereBenachrichtigungGelesen(id));
  }

  return (
    <div className="notification-bell">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Benachrichtigungen"
        className="icon-btn"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {ungelesen > 0 && <span className="notification-count">{ungelesen}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          {items.length === 0 ? (
            <p className="empty-state">Keine Benachrichtigungen.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={n.gelesen ? "" : "notification-unread"}
                  onClick={() => markiereGelesen(n.id)}
                >
                  <span
                    className="dot"
                    style={{ marginTop: 6, background: n.gelesen ? "var(--faint)" : "var(--danger)" }}
                    aria-hidden
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.text}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {new Date(n.erstellt_am).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
