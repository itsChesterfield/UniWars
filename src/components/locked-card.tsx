"use client";

import type { ReactNode } from "react";

export function LockedCard({
  icon,
  title,
  description,
  right,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card locked-card ${className ?? ""}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 16 }}>
          <div className="locked-icon">{icon}</div>
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h3 style={{ fontSize: 16 }}>{title}</h3>
              <span className="tag">Gesperrt</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{description}</div>
          </div>
        </div>
        {right}
      </div>
    </section>
  );
}
