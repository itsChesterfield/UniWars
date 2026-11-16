"use client";

import { useSyncExternalStore } from "react";

function abonnieren(melden: () => void) {
  window.addEventListener("online", melden);
  window.addEventListener("offline", melden);
  return () => {
    window.removeEventListener("online", melden);
    window.removeEventListener("offline", melden);
  };
}

/** true, solange der Browser eine Verbindung meldet. Auf dem Server immer true. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    abonnieren,
    () => navigator.onLine,
    () => true,
  );
}
