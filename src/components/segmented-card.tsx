"use client";

import { useState, type ReactNode } from "react";

export type Segment = {
  key: string;
  label: string;
  content: ReactNode;
};

export function SegmentedCard({
  title,
  subtitle,
  segments,
  className,
  banner,
}: {
  title: string;
  subtitle?: ReactNode;
  segments: Segment[];
  className?: string;
  banner?: ReactNode;
}) {
  const [active, setActive] = useState(segments[0]?.key);
  const aktiv = segments.find((s) => s.key === active) ?? segments[0];

  return (
    <section className={`card ${className ?? ""}`}>
      <div className="ch">
        <div className="row" style={{ gap: 12 }}>
          <span className="ct">{title}</span>
          {subtitle && <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{subtitle}</span>}
        </div>
        {segments.length > 1 && (
          <div className="segwrap">
            {segments.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`seg ${s.key === aktiv?.key ? "on" : ""}`}
                onClick={() => setActive(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {banner}
      <div style={{ minHeight: 220 }}>{aktiv?.content}</div>
    </section>
  );
}
