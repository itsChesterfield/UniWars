"use client";

import { useState, useTransition } from "react";
import { markiereBenachrichtigungGelesen } from "@/app/benachrichtigung/actions";
import { einladungAnnehmen, einladungAblehnen } from "@/app/einladung/actions";
import type { Tables } from "@/lib/supabase/types";
import { track } from "@/lib/analytics";

type Benachrichtigung = Tables<"benachrichtigung">;
type Einladung = Tables<"einladung">;

export function NotificationBell({
  initial,
  initialEinladungen = [],
}: {
  initial: Benachrichtigung[];
  initialEinladungen?: Einladung[];
}) {
  const [items, setItems] = useState(initial);
  const [einladungen, setEinladungen] = useState(initialEinladungen);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const ungelesen = items.filter((n) => !n.gelesen).length + einladungen.length;

  function markiereGelesen(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, gelesen: true } : n)));
    startTransition(() => markiereBenachrichtigungGelesen(id));
    track("benachrichtigung_gelesen");
  }

  function annehmen(id: string) {
    setEinladungen((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => einladungAnnehmen(id));
    track("einladung_angenommen");
  }

  function ablehnen(id: string) {
    setEinladungen((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => einladungAblehnen(id));
    track("einladung_abgelehnt");
  }

  return (
    <div className="notification-bell">
      <button
        type="button"
        onClick={() => {
          if (!open) {
            track("benachrichtigungen_geoeffnet", {
              ungelesen: items.filter((n) => !n.gelesen).length,
              offene_einladungen: einladungen.length,
            });
          }
          setOpen((o) => !o);
        }}
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
          {einladungen.length === 0 && items.length === 0 ? (
            <p className="empty-state">Keine Benachrichtigungen.</p>
          ) : (
            <ul>
              {einladungen.map((e) => (
                <li key={e.id} className="notification-unread einladung-item">
                  <span className="dot" style={{ marginTop: 6, background: "var(--accent-strong)" }} aria-hidden />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <strong>{e.von_username ?? "Jemand"}</strong> hat dich zu{" "}
                      <strong>„{e.ziel_titel}“</strong> eingeladen
                    </div>
                    {e.ziel_faellig_am && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                        Fällig am{" "}
                        {new Date(e.ziel_faellig_am).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                    <div className="row" style={{ gap: 8, marginTop: 7 }}>
                      <button
                        type="button"
                        className="btnp"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={() => annehmen(e.id)}
                      >
                        Annehmen
                      </button>
                      <button
                        type="button"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={() => ablehnen(e.id)}
                      >
                        Ablehnen
                      </button>
                    </div>
                  </div>
                </li>
              ))}
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
