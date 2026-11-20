"use client";

import { useEffect } from "react";

/**
 * Meldet `public/sw.js` an (nur im fertigen Build): er zeigt ohne Netz den Offline-Hinweis statt der Fehlerseite des Browsers.
 * Kein Zwischenspeichern von Daten, siehe Kommentar in sw.js.
 */
export function ServiceWorkerAnmelden() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Nicht in der zweiten Ansicht (iframe) und nicht doppelt
    if (window.self !== window.top) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Ohne Service Worker bleibt alles wie bisher, nur ohne Offline-Hinweis
    });
  }, []);
  return null;
}
