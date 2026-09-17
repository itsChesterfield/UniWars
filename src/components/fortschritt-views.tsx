"use client";

import type { Tables } from "@/lib/supabase/types";

type Fach = Tables<"fach">;
type Settings = Tables<"settings">;

export function AnwesenheitUebersicht({ faecher }: { faecher: Fach[] }) {
  const relevante = faecher.filter((f) => f.anwesenheitspflicht && f.max_fehltage != null);

  if (relevante.length === 0) {
    return <p className="empty-state">Kein Fach mit Anwesenheitspflicht.</p>;
  }

  return (
    <div style={{ paddingTop: 6 }}>
      {relevante.map((f) => {
        const anteil = Math.min(f.fehltage_genutzt / (f.max_fehltage ?? 1), 1);
        const kritisch = f.max_fehltage != null && f.fehltage_genutzt >= f.max_fehltage - 1;
        return (
          <div key={f.id} style={{ marginBottom: 16 }}>
            <div className="rowb" style={{ marginBottom: 7 }}>
              <span className="row" style={{ gap: 10 }}>
                <span className="dot" style={{ background: f.farbe ?? "#94a3b8" }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{f.name}</span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {f.fehltage_genutzt} / {f.max_fehltage} Fehltage
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${anteil * 100}%`,
                  background: kritisch ? "var(--warn)" : "var(--accent)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StreakUebersicht({ settings }: { settings: Settings }) {
  const pips = Array.from({ length: 7 }, (_, i) => i < Math.min(settings.streak_count, 7));

  return (
    <div style={{ paddingTop: 10 }}>
      <div className="row" style={{ gap: 16 }}>
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: "50%",
            background: "var(--warn-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <span style={{ fontSize: 30 }}>🔥</span>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
            {settings.streak_count} {settings.streak_count === 1 ? "Tag" : "Tage"}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
            {settings.streak_freezes} {settings.streak_freezes === 1 ? "Streak-Freeze" : "Streak-Freezes"} übrig
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 5, marginTop: 20 }}>
        {pips.map((an, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 3,
              background: an ? "var(--warn)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
