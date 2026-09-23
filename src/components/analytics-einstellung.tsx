"use client";

import { useState, useSyncExternalStore } from "react";
import { ablehnen, einwilligen, einwilligungsStatus, type Einwilligung } from "@/lib/analytics";

const keinAbo = () => () => {};

export function AnalyticsEinstellung() {
  const gespeichert = useSyncExternalStore<Einwilligung>(keinAbo, einwilligungsStatus, () => "pending");
  const [lokal, setLokal] = useState<Einwilligung | null>(null);
  const erlaubt = (lokal ?? gespeichert) === "granted";

  function umschalten() {
    if (erlaubt) {
      ablehnen();
      setLokal("denied");
    } else {
      einwilligen();
      setLokal("granted");
    }
  }

  return (
    <button type="button" className="sidebar-theme-toggle" onClick={umschalten}>
      <span>Nutzungsanalyse</span>
      <span style={{ color: "var(--accent-strong)" }}>{erlaubt ? "An" : "Aus"}</span>
    </button>
  );
}
