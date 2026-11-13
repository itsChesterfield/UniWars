"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuellenTyp } from "@/lib/literatur/apa";
import type { Tables } from "@/lib/supabase/types";

export type Quelle = Tables<"literatur_quelle">;

export type QuelleEingabe = {
  typ: QuellenTyp;
  autoren: string;
  titel: string;
  jahr: number;
  verlag: string;
  url: string;
  abgerufenAm: string;
  seiten: string;
  fachId: string | null;
  notiz: string;
  dateiId: string | null;
};

const TYPEN: QuellenTyp[] = ["BUCH", "ARTIKEL", "WEBSEITE"];

function leerZuNull(wert: string, max: number): string | null {
  const t = wert.trim();
  if (!t) return null;
  if (t.length > max) throw new Error("Eine Angabe ist zu lang.");
  return t;
}

/** LIT-01: Pflichtfelder prüfen (Webseite: URL + Abrufdatum). */
function pruefen(e: QuelleEingabe) {
  if (!TYPEN.includes(e.typ)) throw new Error("Bitte einen Typ wählen.");
  const autoren = e.autoren.trim();
  const titel = e.titel.trim();
  if (!autoren) throw new Error("Bitte mindestens einen Autor angeben.");
  if (!titel) throw new Error("Bitte einen Titel angeben.");
  const jahr = Math.floor(Number(e.jahr));
  if (!Number.isFinite(jahr) || jahr < 1000 || jahr > 2200) throw new Error("Bitte ein gültiges Jahr angeben.");
  const url = leerZuNull(e.url, 2000);
  if (url) {
    let geparst: URL;
    try {
      geparst = new URL(url);
    } catch {
      throw new Error("Die URL ist ungültig.");
    }
    if (geparst.protocol !== "http:" && geparst.protocol !== "https:") throw new Error("Nur http(s)-Links sind erlaubt.");
  }
  const abgerufen = e.abgerufenAm.trim() || null;
  if (abgerufen && !/^\d{4}-\d{2}-\d{2}$/.test(abgerufen)) throw new Error("Ungültiges Abrufdatum.");
  if (e.typ === "WEBSEITE" && (!url || !abgerufen)) throw new Error("Bei Webseiten sind URL und Abrufdatum Pflicht.");
  return {
    typ: e.typ,
    autoren: autoren.slice(0, 1000),
    titel: titel.slice(0, 500),
    jahr,
    verlag: leerZuNull(e.verlag, 300),
    url,
    abgerufen_am: abgerufen,
    seiten: leerZuNull(e.seiten, 50),
    fach_id: e.fachId || null,
    notiz: leerZuNull(e.notiz, 5000),
    datei_id: e.dateiId || null,
  };
}

export async function quelleSpeichern(id: string | null, eingabe: QuelleEingabe): Promise<Quelle> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const daten = pruefen(eingabe);

  const antwort = id
    ? await supabase.from("literatur_quelle").update(daten).eq("id", id).select().single()
    : await supabase
        .from("literatur_quelle")
        .insert({ ...daten, user_id: user.id })
        .select()
        .single();
  if (antwort.error) throw new Error(antwort.error.message);
  revalidatePath("/literaturverwaltung");
  return antwort.data;
}

export async function quelleLoeschen(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("literatur_quelle").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/literaturverwaltung");
}
