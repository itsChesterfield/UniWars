"use server";

import { unzipSync, strFromU8 } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { markdownAlsText } from "@/lib/markdown-text";
import { designLesen, folienLesen, type Design, type Folie } from "@/lib/praesentationen/folien";
import { elementeLesen, type Element } from "@/lib/whiteboard/elemente";

export type MaterialVorschau =
  | { art: "pdf" | "bild" | "audio"; url: string }
  | { art: "folie"; folie: Folie; design: Design }
  | { art: "whiteboard"; elemente: Element[] }
  | { art: "text"; zeilen: string[] };

export async function vorschauLaden(art: string, id: string): Promise<MaterialVorschau | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  switch (art) {
    case "datei": {
      const { data } = await supabase.from("datei").select("mime_typ, speicher_pfad").eq("id", id).maybeSingle();
      if (!data) return null;
      const mime = data.mime_typ;
      const typ = mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "bild" : mime.startsWith("audio/") ? "audio" : null;
      if (typ) return { art: typ, url: `/dateiablage/inhalt/${id}` };
      if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        const { data: blob } = await supabase.storage.from("dateiablage").download(data.speicher_pfad);
        if (!blob || blob.size > 25 * 1024 * 1024) return null;
        try {
          const dateien = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
            filter: (datei) => datei.name === "ppt/slides/slide1.xml" && datei.originalSize < 200_000,
          });
          const erste = dateien["ppt/slides/slide1.xml"];
          if (!erste) return null;
          const zeilen = [...strFromU8(erste).matchAll(/<a:t>([^<]{0,3000})<\/a:t>/g)]
            .slice(0, 16).map((treffer) => treffer[1].replace(/&(amp|lt|gt|apos|quot);/g, (_, zeichen: string) =>
              ({ amp: "&", lt: "<", gt: ">", apos: "'", quot: '"' })[zeichen] ?? ""));
          return { art: "text", zeilen };
        } catch { return null; }
      }
      return null;
    }
    case "praesentation": {
      const { data } = await supabase.from("praesentation").select("folien, design").eq("id", id).maybeSingle();
      const erste = folienLesen(data?.folien)[0];
      return erste ? { art: "folie", folie: erste, design: designLesen(data?.design) } : null;
    }
    case "whiteboard": {
      const { data } = await supabase.from("whiteboard").select("daten").eq("id", id).maybeSingle();
      return data ? { art: "whiteboard", elemente: elementeLesen(data.daten).slice(0, 300) } : null;
    }
    case "stapel": {
      const { data } = await supabase.from("kk_karte").select("vorderseite").eq("stapel_id", id).order("erstellt_am").limit(3);
      return data ? { art: "text", zeilen: data.map((karte) => markdownAlsText(karte.vorderseite).slice(0, 400)) } : null;
    }
    case "notiz": {
      const { data } = await supabase.from("notiz").select("inhalt").eq("id", id).maybeSingle();
      return data ? { art: "text", zeilen: [markdownAlsText(data.inhalt).slice(0, 1000)] } : null;
    }
    default:
      return null;
  }
}
