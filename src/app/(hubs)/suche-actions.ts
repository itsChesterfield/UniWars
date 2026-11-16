"use server";

import { createClient } from "@/lib/supabase/server";
import type { SuchTreffer } from "@/lib/befehle";

/** Für ilike: % und _ wörtlich nehmen */
function muster(q: string): string {
  return `%${q.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
}

function datumKurz(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
}

/** Strg+O: alles durchsuchen (nur eigene bzw. geteilte Daten – RLS), je Art höchstens 6 Treffer */
export async function allesSuchen(eingabe: string): Promise<SuchTreffer[]> {
  const q = String(eingabe ?? "").trim().slice(0, 100);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const m = muster(q);
  const n = 6;

  const [pdfs, dateien, notizen, stapel, quizze, podcasts, deadlines, pruefungen, todos, faecher, dokumente, tabellen, praesentationen, mindmaps, whiteboards, transkripte, literatur, seiten] =
    await Promise.all([
      supabase.from("datei").select("id, name").eq("mime_typ", "application/pdf").ilike("name", m).limit(n),
      supabase.from("datei").select("id, name, mime_typ").neq("mime_typ", "application/pdf").ilike("name", m).limit(n),
      supabase.from("notiz").select("id, titel").ilike("titel", m).order("geaendert_am", { ascending: false }).limit(n),
      supabase.from("kk_stapel").select("id, name").ilike("name", m).limit(n),
      supabase.from("quiz").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("podcast").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("deadline").select("id, titel, faellig_am, erledigt").ilike("titel", m).order("faellig_am", { ascending: false }).limit(n),
      supabase.from("pruefung").select("id, titel, datum").ilike("titel", m).order("datum", { ascending: false }).limit(n),
      supabase.from("todo").select("id, titel, erledigt").ilike("titel", m).limit(n),
      supabase.from("fach").select("id, name").ilike("name", m).limit(n),
      supabase.from("dokument").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("tabelle").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("praesentation").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("mindmap").select("id, name").ilike("name", m).limit(n),
      supabase.from("whiteboard").select("id, name").ilike("name", m).limit(n),
      supabase.from("transkript").select("id, titel").ilike("titel", m).limit(n),
      supabase.from("literatur_quelle").select("id, titel").ilike("titel", m).limit(n),
      // Volltext in eingelesenen PDF-Seiten
      q.length >= 3 ? supabase.from("quelle_seite").select("datei_id, seite, text").ilike("text", m).limit(8) : Promise.resolve({ data: [] as { datei_id: string; seite: number; text: string }[] }),
    ]);

  const t: SuchTreffer[] = [];
  for (const x of pdfs.data ?? []) t.push({ art: "pdf", id: x.id, titel: x.name, href: `/pdf-reader/${x.id}`, icon: "📕", info: "PDF" });
  for (const x of notizen.data ?? []) t.push({ art: "notiz", id: x.id, titel: x.titel || "Unbenannte Notiz", href: `/notizen?id=${x.id}`, icon: "📝", info: "Notiz" });
  for (const x of stapel.data ?? []) t.push({ art: "stapel", id: x.id, titel: x.name, href: `/karteikarten/${x.id}`, icon: "🗂️", info: "Karteikarten" });
  for (const x of quizze.data ?? []) t.push({ art: "quiz", id: x.id, titel: x.titel, href: `/karteikarten/quiz/${x.id}`, icon: "🎯", info: "Quiz" });
  for (const x of deadlines.data ?? [])
    t.push({ art: "deadline", id: x.id, titel: x.titel, href: `/?detail=deadline:${x.id}`, icon: x.erledigt ? "✅" : "⏰", info: `Deadline · ${datumKurz(x.faellig_am)}` });
  for (const x of pruefungen.data ?? []) t.push({ art: "pruefung", id: x.id, titel: x.titel, href: `/?detail=pruefung:${x.id}`, icon: "🎓", info: `Prüfung · ${datumKurz(x.datum)}` });
  for (const x of todos.data ?? []) t.push({ art: "todo", id: x.id, titel: x.titel, href: `/?detail=todo:${x.id}`, icon: x.erledigt ? "☑️" : "◻️", info: "To-do" });
  for (const x of faecher.data ?? []) t.push({ art: "fach", id: x.id, titel: x.name, href: `/lernraum/${x.id}`, icon: "📚", info: "Fach · Lernraum" });
  for (const x of dokumente.data ?? []) t.push({ art: "dokument", id: x.id, titel: x.titel, href: `/textverarbeitung/${x.id}`, icon: "📄", info: "Dokument" });
  for (const x of tabellen.data ?? []) t.push({ art: "tabelle", id: x.id, titel: x.titel, href: `/tabellen/${x.id}`, icon: "📊", info: "Tabelle" });
  for (const x of praesentationen.data ?? []) t.push({ art: "praesentation", id: x.id, titel: x.titel, href: `/praesentationen/${x.id}`, icon: "🖥️", info: "Präsentation" });
  for (const x of mindmaps.data ?? []) t.push({ art: "mindmap", id: x.id, titel: x.name, href: `/mindmap/${x.id}`, icon: "🧠", info: "MindMap" });
  for (const x of whiteboards.data ?? []) t.push({ art: "whiteboard", id: x.id, titel: x.name, href: `/whiteboard/${x.id}`, icon: "🖍️", info: "Whiteboard" });
  for (const x of transkripte.data ?? []) t.push({ art: "transkript", id: x.id, titel: x.titel, href: `/transkription/${x.id}`, icon: "🎙️", info: "Transkript" });
  for (const x of podcasts.data ?? []) t.push({ art: "podcast", id: x.id, titel: x.titel, href: `/transkription/podcast/${x.id}`, icon: "🎧", info: "Podcast" });
  for (const x of literatur.data ?? []) t.push({ art: "literatur", id: x.id, titel: x.titel, href: `/literaturverwaltung`, icon: "📚", info: "Literatur" });
  for (const x of dateien.data ?? []) t.push({ art: "datei", id: x.id, titel: x.name, href: `/dateiablage`, icon: "📎", info: "Datei" });

  // Fundstellen im Text der PDFs (Titel nachladen)
  const seitenTreffer = seiten.data ?? [];
  if (seitenTreffer.length) {
    const ids = [...new Set(seitenTreffer.map((s) => s.datei_id))];
    const { data: namen } = await supabase.from("datei").select("id, name").in("id", ids);
    for (const s of seitenTreffer) {
      const name = namen?.find((x) => x.id === s.datei_id)?.name ?? "PDF";
      const pos = s.text.toLowerCase().indexOf(q.toLowerCase());
      const ausschnitt = s.text.slice(Math.max(0, pos - 50), pos + q.length + 70).replace(/\s+/g, " ").trim();
      t.push({ art: "fundstelle", id: `${s.datei_id}-${s.seite}`, titel: `${name} · S. ${s.seite}`, href: `/pdf-reader/${s.datei_id}?seite=${s.seite}`, icon: "🔎", info: `…${ausschnitt}…` });
    }
  }
  return t;
}
