"use client";

import { useOnline } from "@/lib/online";

/**
 * Design B3, Zustand „Offline“ (DESIGN.md Abschnitt 8): KI-Bereiche sagen, was später passiert.
 * Erscheint nur ohne Verbindung.
 */
export function OfflineHinweis({ text }: { text: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="offline-hinweis" role="status">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3l18 18" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5" />
        <circle cx="12" cy="20" r="0.6" />
      </svg>
      <span>{text}</span>
    </p>
  );
}
