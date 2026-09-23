"use client";

import { useState, useSyncExternalStore } from "react";
import { ablehnen, einwilligen, einwilligungsStatus, type Einwilligung } from "@/lib/analytics";

const keinAbo = () => () => {};

export function AnalyticsBanner() {
  const status = useSyncExternalStore<Einwilligung>(keinAbo, einwilligungsStatus, () => "granted");
  const [entschieden, setEntschieden] = useState(false);

  if (status !== "pending" || entschieden) return null;

  return (
    <div className="analytics-banner" role="dialog" aria-label="Einwilligung zur Nutzungsanalyse">
      <p>
        Dürfen wir anonymisiert erfassen, wie du UniWars nutzt? Das hilft uns, die App zu
        verbessern. Dafür speichern wir Daten in deinem Browser. Du kannst das jederzeit in der
        Seitenleiste ändern.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btnp"
          onClick={() => {
            einwilligen();
            setEntschieden(true);
          }}
        >
          Einverstanden
        </button>
        <button
          type="button"
          className="btng"
          onClick={() => {
            ablehnen();
            setEntschieden(true);
          }}
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}
