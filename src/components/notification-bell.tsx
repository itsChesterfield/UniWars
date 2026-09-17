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
        className="notification-bell-toggle"
      >
        🔔
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
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
