"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

type Treffer = {
  id: string;
  typ: "Fach" | "Deadline" | "To-Do" | "Note" | "Notiz" | "Karteikarten" | "Datei" | "Quelle" | "Dokument" | "Tabelle" | "Präsentation";
  titel: string;
  href?: string;
};

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

      // ALL-09: auch Einträge aus den Hubs (Titel und Text). PostgREST-Filter-Syntax
      // verträgt keine Kommas/Klammern im Suchbegriff -> diese entfernen.
      const sicher = `%${query.trim().replace(/[,()]/g, " ")}%`;
      const [
        { data: faecher },
        { data: deadlines },
        { data: todos },
        { data: notes },
        { data: notizen },
        { data: stapel },
        { data: karten },
        { data: dateien },
        { data: quellen },
        { data: dokumente },
        { data: tabellen },
        { data: praesentationen },
      ] = await Promise.all([
        supabase.from("fach").select("id, name").ilike("name", pattern).limit(5),
        supabase.from("deadline").select("id, titel").ilike("titel", pattern).limit(5),
        supabase.from("todo").select("id, titel").ilike("titel", pattern).limit(5),
        supabase.from("note").select("id, titel").ilike("titel", pattern).limit(5),
        supabase.from("notiz").select("id, titel").or(`titel.ilike.${sicher},inhalt.ilike.${sicher}`).limit(5),
        supabase.from("kk_stapel").select("id, name").ilike("name", pattern).limit(3),
        supabase
          .from("kk_karte")
          .select("id, stapel_id, vorderseite")
          .or(`vorderseite.ilike.${sicher},rueckseite.ilike.${sicher}`)
          .limit(3),
        supabase.from("datei").select("id, name, fach_id, mime_typ").ilike("name", pattern).limit(5),
        supabase.from("literatur_quelle").select("id, titel, jahr").or(`titel.ilike.${sicher},autoren.ilike.${sicher}`).limit(5),
        supabase.from("dokument").select("id, titel").or(`titel.ilike.${sicher},klartext.ilike.${sicher}`).limit(5),
        supabase.from("tabelle").select("id, titel").ilike("titel", pattern).limit(5),
        supabase.from("praesentation").select("id, titel").ilike("titel", pattern).limit(5),
      ]);

      const treffer = [
        ...(faecher ?? []).map((f) => ({ id: f.id, typ: "Fach" as const, titel: f.name })),
        ...(deadlines ?? []).map((d) => ({ id: d.id, typ: "Deadline" as const, titel: d.titel })),
        ...(todos ?? []).map((t) => ({ id: t.id, typ: "To-Do" as const, titel: t.titel })),
        ...(notes ?? []).map((n) => ({ id: n.id, typ: "Note" as const, titel: n.titel })),
        ...(notizen ?? []).map((n) => ({
          id: n.id,
          typ: "Notiz" as const,
          titel: n.titel || "Unbenannte Notiz",
          href: `/notizen?id=${n.id}`,
        })),
        ...(stapel ?? []).map((s) => ({
          id: s.id,
          typ: "Karteikarten" as const,
          titel: `Stapel: ${s.name}`,
          href: `/karteikarten/${s.id}`,
        })),
        ...(karten ?? []).map((k) => ({
          id: k.id,
          typ: "Karteikarten" as const,
          titel: k.vorderseite.replace(/[#*_`>\[\]-]/g, "").trim().slice(0, 80),
          href: `/karteikarten/${k.stapel_id}`,
        })),
        ...(dateien ?? []).map((d) => ({
          id: d.id,
          typ: "Datei" as const,
          titel: d.name,
          href: d.mime_typ === "application/pdf" ? `/pdf-reader/${d.id}` : `/dateiablage${d.fach_id ? `?ordner=${d.fach_id}` : ""}`,
        })),
        ...(quellen ?? []).map((q) => ({
          id: q.id,
          typ: "Quelle" as const,
          titel: `${q.titel} (${q.jahr})`,
          href: "/literaturverwaltung",
        })),
        ...(dokumente ?? []).map((d) => ({
          id: d.id,
          typ: "Dokument" as const,
          titel: d.titel || "Unbenanntes Dokument",
          href: `/textverarbeitung/${d.id}`,
        })),
        ...(tabellen ?? []).map((t) => ({
          id: t.id,
          typ: "Tabelle" as const,
          titel: t.titel || "Unbenannte Tabelle",
          href: `/tabellen/${t.id}`,
        })),
        ...(praesentationen ?? []).map((p) => ({
          id: p.id,
          typ: "Präsentation" as const,
          titel: p.titel,
          href: `/praesentationen/${p.id}`,
        })),
      ];
      setErgebnisse(treffer);
      track("suche_ausgefuehrt", { suchlaenge: query.trim().length, treffer: treffer.length });
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
      <span className="search-bar-icon" aria-hidden>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </span>
      <input
        type="search"
        placeholder="Alles durchsuchen — Fach, Deadline, To-Do, Notiz …"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <span className="kbd">Q</span>

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
                  <li key={t.id}>{t.href ? <Link href={t.href}>{t.titel}</Link> : t.titel}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
