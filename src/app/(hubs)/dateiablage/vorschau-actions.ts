"use server";

import { excelZellen, EXCEL_MIME, powerpointText, POWERPOINT_MIME, wordText, WORD_MIME } from "@/lib/dateiablage/office-inhalt";
import { adresse, anzeigen, auswerten, datenLesen, genutzterBereich } from "@/lib/tabellen/formeln";
import { createClient } from "@/lib/supabase/server";
import { materialRef } from "@/lib/dateiablage/material";
import { materialQuelle } from "@/lib/dateiablage/material-server";
import { markdownAlsText } from "@/lib/markdown-text";
import { designLesen, folienLesen, type Design, type Folie } from "@/lib/praesentationen/folien";
import { elementeLesen, type Element } from "@/lib/whiteboard/elemente";

export type MaterialVorschau =
  | { art: "pdf" | "bild" | "audio"; url: string }
  | { art: "folie"; folie: Folie; design: Design }
  | { art: "whiteboard"; elemente: Element[] }
  | { art: "tabelle"; zeilen: string[][] }
  | { art: "text"; zeilen: string[] };

export async function vorschauLaden(art: string, id: string): Promise<MaterialVorschau | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ref = materialRef({ art, id });
  if (!user || !ref) return null;
  switch (art) {
    case "datei": {
      const { data } = await supabase.from("datei").select("mime_typ, speicher_pfad").eq("id", id).maybeSingle();
      if (!data) return null;
      const mime = data.mime_typ;
      const typ = mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "bild" : mime.startsWith("audio/") ? "audio" : null;
      if (typ) return { art: typ, url: `/dateiablage/inhalt/${id}` };
      if (mime === "text/plain") {
        const { data: blob } = await supabase.storage.from("dateiablage").download(data.speicher_pfad);
        const text = blob ? await blob.slice(0, 4000).text() : "";
        return blob ? { art: "text", zeilen: text.trim().split(/\r?\n/).slice(0, 12) } : null;
      }
      if (mime === POWERPOINT_MIME || mime === WORD_MIME || mime === EXCEL_MIME) {
        const { data: blob } = await supabase.storage.from("dateiablage").download(data.speicher_pfad);
        if (!blob) return null;
        if (mime === WORD_MIME) return { art: "text", zeilen: await wordText(blob) };
        if (mime === EXCEL_MIME) return { art: "tabelle", zeilen: await excelZellen(blob) };
        const [folie] = await powerpointText(blob, 1);
        return folie ? { art: "text", zeilen: folie.text.split("\n") } : null;
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
    case "dokument": {
      const { data } = await supabase.from("dokument").select("klartext").eq("id", id).maybeSingle();
      return data ? { art: "text", zeilen: [data.klartext.slice(0, 1000)] } : null;
    }
    case "tabelle": {
      const { data } = await supabase.from("tabelle").select("daten").eq("id", id).maybeSingle();
      if (!data) return null;
      const tabelle = datenLesen(data.daten);
      const bereich = genutzterBereich(tabelle);
      const werte = auswerten(tabelle);
      const zeilen = Array.from({ length: Math.min(8, bereich.zeilen) }, (_, zeile) =>
        Array.from({ length: Math.min(6, bereich.spalten) }, (_, spalte) => {
          const ref = adresse(spalte, zeile);
          return anzeigen(werte.get(ref), tabelle.zellen[ref]?.fmt).slice(0, 120);
        }));
      return { art: "tabelle", zeilen };
    }
    default: {
      const quelle = await materialQuelle(supabase, ref, 3);
      return quelle ? { art: "text", zeilen: quelle.abschnitte.map((teil) => teil.text.slice(0, 500)) } : null;
    }
  }
}
