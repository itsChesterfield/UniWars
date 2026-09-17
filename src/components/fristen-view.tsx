"use client";

import type { Tables } from "@/lib/supabase/types";

type Deadline = Tables<"deadline">;

function IconWiederholung() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function IconDokument() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconBeitrag() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function FristenView({ deadlines }: { deadlines: Deadline[] }) {
  const fristen = deadlines.filter(
    (d) => d.kategorie !== "NORMAL" || d.wiederhol_regel != null,
  );

  if (fristen.length === 0) {
    return <p className="empty-state">Keine wiederkehrenden Fristen.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {fristen.map((d) => {
        const istBafoeg = d.kategorie === "BAFOEG";
        const wiederkehrend = d.wiederhol_regel != null;
        const Icon = istBafoeg ? IconDokument : wiederkehrend ? IconWiederholung : IconBeitrag;
        const hervorgehoben = istBafoeg;

        return (
          <div
            key={d.id}
            className="rowb"
            style={{
              padding: "12px 14px",
              borderRadius: 11,
              border: hervorgehoben ? "1px solid var(--warn)" : "1px solid var(--border)",
              background: hervorgehoben ? "var(--warn-soft)" : "transparent",
            }}
          >
            <div className="row" style={{ gap: 12 }}>
              <span style={{ color: hervorgehoben ? "var(--warn)" : "var(--muted)" }}>
                <Icon />
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.titel}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>
                  {wiederkehrend ? "wiederkehrend" : istBafoeg ? "BAföG" : "Semesterbeitrag"}
                </div>
              </div>
            </div>
            <span className={`tag ${hervorgehoben ? "tag-warn" : "tag-accent"}`}>
              {new Date(d.faellig_am).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
