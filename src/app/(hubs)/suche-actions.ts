"use server";

import { createClient } from "@/lib/supabase/server";
import { fachZuordnungen, MATERIAL_ARTEN, istMaterialId, materialRef } from "@/lib/dateiablage/material";
import { materialQuelle } from "@/lib/dateiablage/material-server";
import { pdfAusschnitt, pdfPfad } from "@/lib/pdf-reader/fundstelle";
import { ablageDateiname, istWebLink } from "@/lib/dateiablage/weblink";
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
export async function allesSuchen(eingabe: string, eigeneUnterlagen = false): Promise<SuchTreffer[]> {
  const q = String(eingabe ?? "").trim().slice(0, 100);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const m = muster(q);
  // PostgREST-or()-Filter verträgt keine Kommas/Klammern im Suchbegriff
  const sicher = muster(q.replace(/[,()]/g, " "));
  const n = 6;
  const eigene = <T extends { eq: (spalte: "user_id", id: string) => T }>(abfrage: T): T =>
    eigeneUnterlagen ? abfrage.eq("user_id", user.id) : abfrage;

  const [pdfs, dateien, notizen, stapel, quizze, podcasts, deadlines, pruefungen, todos, faecher, dokumente, tabellen, praesentationen, mindmaps, whiteboards, transkripte, literatur, seiten, karten, noten, titelTreffer] =
    await Promise.all([
      eigene(supabase.from("datei").select("id, name")).eq("mime_typ", "application/pdf").ilike("name", m).limit(n),
      eigene(supabase.from("datei").select("id, name, mime_typ, speicher_pfad")).neq("mime_typ", "application/pdf").ilike("name", m).limit(n),
      eigene(supabase.from("notiz").select("id, titel")).or(`titel.ilike.${sicher},inhalt.ilike.${sicher}`).order("geaendert_am", { ascending: false }).limit(n),
      eigene(supabase.from("kk_stapel").select("id, name")).ilike("name", m).limit(n),
      eigene(supabase.from("quiz").select("id, titel")).ilike("titel", m).limit(n),
      eigene(supabase.from("podcast").select("id, titel")).ilike("titel", m).limit(n),
      supabase.from("deadline").select("id, titel, faellig_am, erledigt").ilike("titel", m).order("faellig_am", { ascending: false }).limit(n),
      supabase.from("pruefung").select("id, titel, datum").ilike("titel", m).order("datum", { ascending: false }).limit(n),
      supabase.from("todo").select("id, titel, erledigt").ilike("titel", m).limit(n),
      supabase.from("fach").select("id, name").ilike("name", m).limit(n),
      eigene(supabase.from("dokument").select("id, titel")).ilike("titel", m).limit(n),
      eigene(supabase.from("tabelle").select("id, titel")).ilike("titel", m).limit(n),
      eigene(supabase.from("praesentation").select("id, titel")).ilike("titel", m).limit(n),
      eigene(supabase.from("mindmap").select("id, name")).ilike("name", m).limit(n),
      eigene(supabase.from("whiteboard").select("id, name")).ilike("name", m).limit(n),
      eigene(supabase.from("transkript").select("id, titel")).ilike("titel", m).limit(n),
      eigene(supabase.from("literatur_quelle").select("id, titel")).ilike("titel", m).limit(n),
      // Volltext in eingelesenen PDF-Seiten
      q.length >= 3 ? eigene(supabase.from("quelle_seite").select("datei_id, seite, text")).ilike("text", m).limit(8) : Promise.resolve({ data: [] as { datei_id: string; seite: number; text: string }[] }),
      supabase.from("kk_karte").select("id, stapel_id, vorderseite").or(`vorderseite.ilike.${sicher},rueckseite.ilike.${sicher}`).limit(4),
      supabase.from("note").select("id, titel").ilike("titel", m).limit(4),
      eigene(supabase.from("material_ablage_info").select("art, material_id")).is("papierkorb_am", null).ilike("anzeigetitel", m).limit(12),
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
  for (const x of literatur.data ?? []) t.push({ art: "literatur", id: x.id, titel: x.titel, href: `/literaturverwaltung?id=${x.id}`, icon: "📚", info: "Literatur" });
  for (const x of karten.data ?? []) t.push({ art: "karte", id: x.id, titel: x.vorderseite.slice(0, 120), href: `/karteikarten/${x.stapel_id}`, icon: "🃏", info: "Karteikarte" });
  for (const x of noten.data ?? []) t.push({ art: "note", id: x.id, titel: x.titel, href: "/noten", icon: "💯", info: "Note" });
  for (const x of dateien.data ?? []) t.push({ art: "datei", id: x.id, titel: ablageDateiname(x), href: `/dateiablage/oeffnen/${x.id}`, icon: "📎", info: istWebLink(x) ? "Weblink" : "Datei" });

  const eigeneTitel = await Promise.all((titelTreffer.data ?? []).map((x) => {
    const ref = materialRef({ art: x.art, id: x.material_id });
    return ref ? materialQuelle(supabase, ref, 0) : null;
  }));
  for (const eintrag of eigeneTitel) {
    if (!eintrag) continue;
    const art = eintrag.istPdf ? "pdf" : eintrag.art;
    const bekannt = t.find((x) => x.id === eintrag.id && x.art === art);
    if (bekannt) bekannt.titel = eintrag.titel;
    else t.push({
      art, id: eintrag.id, titel: eintrag.titel, href: eintrag.href, icon: "",
      info: eintrag.istPdf ? "PDF" : eintrag.art === "datei" ? "Datei" : MATERIAL_ARTEN[eintrag.art].name,
    });
  }

  const materialTreffer = t.flatMap((treffer) => {
    const ref = materialRef({ art: treffer.art === "pdf" ? "datei" : treffer.art, id: treffer.id });
    return ref ? [{ ref, treffer }] : [];
  });
  const materialIds = [...new Set(materialTreffer.map(({ ref }) => ref.id))];
  const anzeigetitelLaden = materialIds.length
    ? supabase.from("material_ablage_info").select("art, material_id, anzeigetitel").in("material_id", materialIds).then(({ data }) => data ?? [])
    : Promise.resolve([]);

  // Fundstellen im Text der PDFs (Titel nachladen)
  const seitenTreffer = seiten.data ?? [];
  if (seitenTreffer.length) {
    const ids = [...new Set(seitenTreffer.map((s) => s.datei_id))];
    const [{ data: dateiDetails }, { data: titel }, { data: extras }, { data: faecherDaten }] = await Promise.all([
      supabase.from("datei").select("id, name, fach_id, fach(name)").in("id", ids).eq("mime_typ", "application/pdf"),
      supabase.from("material_ablage_info").select("material_id, anzeigetitel").eq("art", "datei").in("material_id", ids),
      supabase.from("material_ablage_fach").select("material_id, fach_id, ausgeblendet").eq("art", "datei").in("material_id", ids),
      supabase.from("fach").select("id, name"),
    ]);
    const titelMap = new Map((titel ?? []).map((e) => [e.material_id, e.anzeigetitel]));
    const fachMap = new Map((faecherDaten ?? []).map((e) => [e.id, e.name]));
    const dateienNachId = new Map(dateiDetails?.map((datei) => [datei.id, datei]));
    for (const s of seitenTreffer) {
      const datei = dateienNachId.get(s.datei_id);
      const ausschnitt = pdfAusschnitt(s.text, q);
      if (!datei || !ausschnitt) continue;
      t.push({
        art: "fundstelle",
        id: `${s.datei_id}-${s.seite}`,
        titel: `${titelMap.get(datei.id) ?? datei.name} · S. ${s.seite}`,
        href: pdfPfad(s.datei_id, s.seite),
        icon: "🔎",
        info: fachZuordnungen(datei.fach_id, (extras ?? []).filter((e) => e.material_id === datei.id).map((e) => ({ ...e, art: "datei" })))
          .map((id) => fachMap.get(id) ?? (id === datei.fach_id ? datei.fach?.name : null)).filter(Boolean).join(", ") || "Ohne Fach",
        ausschnitt,
      });
    }
  }
  const anzeigetitel = new Map((await anzeigetitelLaden).map((zeile) => [`${zeile.art}:${zeile.material_id}`, zeile.anzeigetitel]));
  for (const { ref, treffer } of materialTreffer) {
    treffer.titel = anzeigetitel.get(`${ref.art}:${ref.id}`) ?? treffer.titel;
  }
  return t;
}

export async function zuletztSichtbareTreffer(roh: unknown): Promise<SuchTreffer[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !Array.isArray(roh)) return [];
  const erlaubt = await Promise.all(roh.slice(0, 6).map(async (wert: unknown): Promise<SuchTreffer | null> => {
    if (!wert || typeof wert !== "object") return null;
    const { art, id, seite } = wert as { art?: string; id?: string; seite?: number };
    if (!istMaterialId(id) || typeof art !== "string") return null;
    const ref = materialRef({ art: art === "pdf" || art === "fundstelle" ? "datei" : art, id });
    if (ref) {
      const q = await materialQuelle(supabase, ref, 0);
      if (!q) return null;
      const pdfSeite = q.istPdf && Number.isSafeInteger(seite) && seite! > 0 && seite! <= 100000 ? seite : undefined;
      return { art, id: pdfSeite ? `${id}-${pdfSeite}` : id, titel: q.titel, href: pdfSeite ? pdfPfad(id, pdfSeite) : q.href,
        icon: "", info: pdfSeite ? `Seite ${pdfSeite}` : q.istPdf ? "PDF" : ref.art === "datei" ? "Datei" : MATERIAL_ARTEN[ref.art].name };
    }
    if (art === "fach") {
      const { data } = await supabase.from("fach").select("name").eq("id", id).maybeSingle();
      return data ? { art, id, titel: data.name, href: `/lernraum/${id}`, icon: "", info: "Fach" } : null;
    }
    if (art === "karte") {
      const { data } = await supabase.from("kk_karte").select("stapel_id, vorderseite").eq("id", id).maybeSingle();
      return data ? { art, id, titel: data.vorderseite.slice(0, 120), href: `/karteikarten/${data.stapel_id}`, icon: "", info: "Karteikarte" } : null;
    }
    if (art === "note" || art === "todo" || art === "deadline" || art === "pruefung") {
      const { data } = await supabase.from(art).select("titel").eq("id", id).maybeSingle();
      return data ? { art, id, titel: data.titel, href: art === "note" ? "/noten" : `/?detail=${art}:${id}`, icon: "",
        info: art === "note" ? "Note" : art === "pruefung" ? "Prüfung" : "Aufgabe" } : null;
    }
    return null;
  }));
  return erlaubt.flatMap((t) => t ? [t] : []);
}
