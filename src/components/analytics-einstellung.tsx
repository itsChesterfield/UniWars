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
    <div className="einst-zeile">
      <span>
        Nutzungsanalyse
        <small>Anonyme Zahlen, welche Funktionen genutzt werden.</small>
      </span>
      <button type="button" className="schalter" role="switch" aria-checked={erlaubt} aria-label="Nutzungsanalyse" onClick={umschalten} />
    </div>
  );
}
