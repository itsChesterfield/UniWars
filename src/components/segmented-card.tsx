"use client";

import { useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

export type Segment = {
  key: string;
  label: string;
  content: ReactNode;
};

/**
 * Design B3: Abschnitt mit Umschalter (Segment) statt Karte. Titel als h2; `titelVerstecken`, wenn
 * der Seitenkopf denselben Namen schon trägt (der Titel bleibt für Screenreader und Analyse).
 */
export function SegmentedCard({
  title,
  titelVerstecken = false,
  subtitle,
  segments,
  className,
  banner,
  aktion,
}: {
  title: string;
  titelVerstecken?: boolean;
  subtitle?: ReactNode;
  segments: Segment[];
  className?: string;
  banner?: ReactNode;
  aktion?: ReactNode;
}) {
  const [active, setActive] = useState(segments[0]?.key);
  const aktiv = segments.find((s) => s.key === active) ?? segments[0];

  return (
    <section className={`segmentkarte ${className ?? ""}`}>
      <div className="segmentkarte-kopf">
        <div className="segmentkarte-titel">
          <h2 className={titelVerstecken ? "vh" : "abschnitt-titel"}>{title}</h2>
          {subtitle && <span className="segmentkarte-untertitel">{subtitle}</span>}
        </div>
        <div className="segmentkarte-rechts">
          {aktion}
          {segments.length > 1 && (
            <div className="segment" role="group" aria-label={`${title}: Ansicht`}>
              {segments.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={s.key === aktiv?.key}
                  onClick={() => {
                    if (s.key !== aktiv?.key) track("segment_gewechselt", { karte: title, segment: s.key });
                    setActive(s.key);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {banner}
      <div className="segmentkarte-inhalt">{aktiv?.content}</div>
    </section>
  );
}
