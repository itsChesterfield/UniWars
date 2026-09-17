"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Treffer = { id: string; typ: "Fach" | "Deadline" | "To-Do" | "Note"; titel: string };

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [ergebnisse, setErgebnisse] = useState<Treffer[]>([]);
  const [open, setOpen] = useState(false);
  const [suchtGerade, setSuchtGerade] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const handle = setTimeout(async () => {
      setSuchtGerade(true);
      const supabase = createClient();
      const pattern = `%${query.trim()}%`;

      const [{ data: faecher }, { data: deadlines }, { data: todos }, { data: notes }] =
        await Promise.all([
          supabase.from("fach").select("id, name").ilike("name", pattern).limit(5),
          supabase.from("deadline").select("id, titel").ilike("titel", pattern).limit(5),
          supabase.from("todo").select("id, titel").ilike("titel", pattern).limit(5),
          supabase.from("note").select("id, titel").ilike("titel", pattern).limit(5),
        ]);

      setErgebnisse([
        ...(faecher ?? []).map((f) => ({ id: f.id, typ: "Fach" as const, titel: f.name })),
        ...(deadlines ?? []).map((d) => ({ id: d.id, typ: "Deadline" as const, titel: d.titel })),
        ...(todos ?? []).map((t) => ({ id: t.id, typ: "To-Do" as const, titel: t.titel })),
        ...(notes ?? []).map((n) => ({ id: n.id, typ: "Note" as const, titel: n.titel })),
      ]);
      setSuchtGerade(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  const gruppiert = ergebnisse.reduce<Record<string, Treffer[]>>((acc, treffer) => {
    (acc[treffer.typ] ??= []).push(treffer);
    return acc;
  }, {});

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Suchen… (Fach, Deadline, To-Do, Note)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && query.trim().length >= 2 && (
        <div className="search-overlay">
          {suchtGerade && ergebnisse.length === 0 && <p className="empty-state">Suche…</p>}
          {!suchtGerade && ergebnisse.length === 0 && (
            <p className="empty-state">Keine Treffer.</p>
          )}
          {Object.entries(gruppiert).map(([typ, treffer]) => (
            <div key={typ} className="search-group">
              <h4>{typ}</h4>
              <ul>
                {treffer.map((t) => (
                  <li key={t.id}>{t.titel}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
