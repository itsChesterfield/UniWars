import "server-only";

import { tabelleFehlt } from "@/lib/hubs/datenbank";
import type { createClient } from "@/lib/supabase/server";
import { materialPfad, materialRef, type HubMaterial, type MaterialArt, type MaterialRef } from "./material";
import { pdfPfad } from "@/lib/pdf-reader/fundstelle";
import { markdownAlsText } from "@/lib/markdown-text";
import { folienLesen } from "@/lib/praesentationen/folien";
import { pdfTextAnfang } from "@/lib/pdf-reader/index-server";
import { powerpointText, POWERPOINT_MIME } from "./office-inhalt";
import { ablageDateiname } from "./weblink";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Zeile = { id: string; fach_id: string | null; user_id: string; erstellt_am: string } & ({ titel: string } | { name: string });

export async function hubMaterialLaden(supabase: Supabase): Promise<HubMaterial[]> {
  const antworten = await Promise.all([
    supabase.from("notiz").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("kk_stapel").select("id, name, fach_id, user_id, erstellt_am"),
    supabase.from("praesentation").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("whiteboard").select("id, name, fach_id, user_id, erstellt_am"),
    supabase.from("mindmap").select("id, name, fach_id, user_id, erstellt_am"),
    supabase.from("dokument").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("tabelle").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("transkript").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("podcast").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("quiz").select("id, titel, fach_id, user_id, erstellt_am"),
    supabase.from("literatur_quelle").select("id, titel, fach_id, user_id, erstellt_am"),
  ]);
  const arten: MaterialArt[] = [
    "notiz", "stapel", "praesentation", "whiteboard", "mindmap", "dokument",
    "tabelle", "transkript", "podcast", "quiz", "literatur",
  ];

  return antworten.flatMap(({ data, error }, index) => {
    if (error && !tabelleFehlt(error)) throw error;
    return (data as Zeile[] | null ?? []).map((zeile) => ({
      art: arten[index],
      id: zeile.id,
      titel: ("titel" in zeile ? zeile.titel : zeile.name) || "Ohne Titel",
      fachId: zeile.fach_id,
      userId: zeile.user_id,
      erstelltAm: zeile.erstellt_am,
    }));
  });
}

export type MaterialQuelle = MaterialRef & {
  titel: string; href: string; fachId: string | null; erstelltAm: string; istPdf: boolean;
  abschnitte: { seite: number; text: string }[];
};

export async function materialQuelle(
  supabase: Supabase, referenz: MaterialRef, seitenLimit = 80, pdfLeseprobe = false,
): Promise<MaterialQuelle | null> {
  const geprueft = materialRef(referenz);
  if (!geprueft) return null;
  const ref: MaterialRef = geprueft;
  const meta = supabase.from("material_ablage_info").select("anzeigetitel").eq("art", ref.art).eq("material_id", ref.id).maybeSingle();
  type Basis = { fach_id: string | null; erstellt_am: string };
  async function quelle(
    original: Basis | null, titel: string, texte: string[] = [], pdf = false,
    seiten?: { seite: number; text: string }[],
  ): Promise<MaterialQuelle | null> {
    if (!original) return null;
    const { data } = await meta;
    return {
      ...ref, titel: data?.anzeigetitel ?? titel,
      href: ref.art === "datei" ? (pdf ? pdfPfad(ref.id) : `/dateiablage/oeffnen/${ref.id}`) : materialPfad({ art: ref.art, id: ref.id }),
      fachId: original.fach_id, erstelltAm: original.erstellt_am, istPdf: pdf,
      abschnitte: seiten ?? texte.filter(Boolean).map((text, i) => ({ seite: i + 1, text: text.slice(0, 16000) })),
    };
  }
  const id = ref.id;
  switch (ref.art) {
    case "datei": {
      const { data } = await supabase.from("datei").select("name, fach_id, erstellt_am, mime_typ, speicher_pfad").eq("id", id).maybeSingle();
      if (!data) return null;
      const pdf = data.mime_typ === "application/pdf";
      if (seitenLimit === 0) return quelle(data, ablageDateiname(data), [], pdf);
      if (data.mime_typ === POWERPOINT_MIME) {
        const { data: blob } = await supabase.storage.from("dateiablage").download(data.speicher_pfad);
        return quelle(data, ablageDateiname(data), [], false, blob ? await powerpointText(blob, seitenLimit) : []);
      }
      if (!pdf) return quelle(data, ablageDateiname(data));
      const { data: seiten } = await supabase.from("quelle_seite").select("seite, text")
        .eq("datei_id", id).order("seite").limit(seitenLimit);
      const auszug = !seiten?.some((s) => s.text.trim()) && pdfLeseprobe
        ? await pdfTextAnfang(supabase, data.speicher_pfad, seitenLimit).catch(() => [])
        : seiten ?? [];
      return quelle(data, ablageDateiname(data), [], true, auszug);
    }
    case "notiz": {
      const { data } = await supabase.from("notiz").select("titel, fach_id, erstellt_am, inhalt").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel || "Unbenannte Notiz", data.inhalt.split(/\n{2,}/).slice(0, seitenLimit).map(markdownAlsText)) : null;
    }
    case "stapel": {
      const { data } = await supabase.from("kk_stapel").select("name, fach_id, erstellt_am").eq("id", id).maybeSingle();
      if (!data) return null;
      const { data: karten } = await supabase.from("kk_karte").select("vorderseite, rueckseite").eq("stapel_id", id).order("erstellt_am").limit(seitenLimit);
      return quelle(data, data.name, (karten ?? []).map((k) => `${k.vorderseite}\n${k.rueckseite}`));
    }
    case "praesentation": {
      const { data } = await supabase.from("praesentation").select("titel, fach_id, erstellt_am, folien").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, folienLesen(data.folien).slice(0, seitenLimit).map((f) => [f.titel, f.text, f.text2].join("\n"))) : null;
    }
    case "dokument": {
      const { data } = await supabase.from("dokument").select("titel, fach_id, erstellt_am, klartext").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [data.klartext]) : null;
    }
    case "transkript": {
      const { data } = await supabase.from("transkript").select("titel, fach_id, erstellt_am, text").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [data.text]) : null;
    }
    case "whiteboard": {
      const { data } = await supabase.from("whiteboard").select("name, fach_id, erstellt_am, daten").eq("id", id).maybeSingle();
      return data ? quelle(data, data.name, [jsonInhalt(data.daten)]) : null;
    }
    case "mindmap": {
      const { data } = await supabase.from("mindmap").select("name, fach_id, erstellt_am, daten").eq("id", id).maybeSingle();
      return data ? quelle(data, data.name, [jsonInhalt(data.daten)]) : null;
    }
    case "tabelle": {
      const { data } = await supabase.from("tabelle").select("titel, fach_id, erstellt_am, daten").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [jsonInhalt(data.daten)]) : null;
    }
    case "podcast": {
      const { data } = await supabase.from("podcast").select("titel, fach_id, erstellt_am, skript").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [jsonInhalt(data.skript)]) : null;
    }
    case "quiz": {
      const { data } = await supabase.from("quiz").select("titel, fach_id, erstellt_am, fragen").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [jsonInhalt(data.fragen)]) : null;
    }
    case "literatur": {
      const { data } = await supabase.from("literatur_quelle").select("titel, fach_id, erstellt_am, autoren, notiz").eq("id", id).maybeSingle();
      return data ? quelle(data, data.titel, [`${data.autoren}\n${data.notiz ?? ""}`]) : null;
    }
  }
}

function jsonInhalt(wert: unknown): string {
  const texte: string[] = [];
  function sammeln(w: unknown, tiefe: number) {
    if (texte.length >= 150 || tiefe > 12 || w == null) return;
    if (typeof w === "string") {
      if (w.trim() && !/^(?:https?:\/\/|#(?:[a-f\d]{3}){1,2}$)/i.test(w)) texte.push(w.slice(0, 1200));
    } else if (Array.isArray(w)) {
      for (const teil of w.slice(0, 200)) sammeln(teil, tiefe + 1);
    } else if (typeof w === "object") {
      for (const [schluessel, teil] of Object.entries(w)) {
        if (!/(?:^id$|_id$|Id$|^typ$|^farbe$|^layout$)/.test(schluessel)) sammeln(teil, tiefe + 1);
      }
    }
  }
  sammeln(wert, 0);
  return texte.join("\n").slice(0, 16000);
}
