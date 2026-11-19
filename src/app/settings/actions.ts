"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Json } from "@/lib/supabase/types";
import { darstellungLesen, istTheme, symbolleisteLesen } from "@/lib/personalisierung";

export async function setTheme(theme: Enums<"theme">): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  if (!istTheme(theme)) return { ok: false };

  const { error } = await supabase.from("settings").update({ theme }).eq("user_id", user.id);
  if (error) return { ok: false };
  // Auch die Hubs nutzen das Theme -> ganzes Layout neu rendern.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Design B3, Personalisierung: Reihenfolge und ausgeblendete Bereiche der Symbolleiste. */
export async function symbolleisteSpeichern(roh: unknown): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const symbolleiste = symbolleisteLesen(roh);
  const { error } = await supabase
    .from("settings")
    .update({ symbolleiste: symbolleiste as unknown as Json })
    .eq("user_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Design B3, Personalisierung: Schriftgröße, Dichte, Bewegung, Design-Schalter in der Kopfleiste. */
export async function darstellungSpeichern(roh: unknown): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const darstellung = darstellungLesen(roh);
  const { error } = await supabase
    .from("settings")
    .update({ darstellung: darstellung as unknown as Json })
    .eq("user_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Einstellungen-Seite: Profil, Profilbild, E-Mail, Passwort
// ---------------------------------------------------------------------------

export type Ergebnis = { ok: true; hinweis?: string } | { ok: false; fehler: string };

async function angemeldet() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

/** Nutzername: 3–20 Zeichen, Kleinbuchstaben, Ziffern, Unterstrich – eindeutig. */
export async function nutzernameAendern(eingabe: string): Promise<Ergebnis> {
  const { supabase, user } = await angemeldet();
  const name = eingabe.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name)) {
    return { ok: false, fehler: "3–20 Zeichen: Kleinbuchstaben, Ziffern und _ (keine Leerzeichen)." };
  }
  const { data: frei } = await supabase.rpc("ist_username_verfuegbar", { p_username: name });
  const { data: eigene } = await supabase.from("settings").select("username").eq("user_id", user.id).maybeSingle();
  if (eigene?.username === name) return { ok: true };
  if (frei === false) return { ok: false, fehler: "Dieser Name ist schon vergeben." };
  const { error } = await supabase.from("settings").update({ username: name }).eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") return { ok: false, fehler: "Dieser Name ist schon vergeben." };
    return { ok: false, fehler: "Speichern hat nicht geklappt." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const PROFILBILD_BUCKET = "profilbild";
const MAX_PROFILBILD_BYTES = 2 * 1024 * 1024;

/** Profilbild speichern: kommt im Browser schon quadratisch verkleinert als JPEG-Data-URL an. */
export async function profilbildSpeichern(dataUrl: string): Promise<Ergebnis> {
  const { supabase, user } = await angemeldet();
  const treffer = typeof dataUrl === "string" ? dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!treffer) return { ok: false, fehler: "Bitte ein Bild (JPG, PNG) auswählen." };
  const bytes = Buffer.from(treffer[2], "base64");
  if (bytes.length > MAX_PROFILBILD_BYTES) return { ok: false, fehler: "Das Bild ist zu groß." };

  const endung = treffer[1] === "jpeg" ? "jpg" : treffer[1];
  const pfad = `${user.id}/${crypto.randomUUID()}.${endung}`;
  const { error: uploadFehler } = await supabase.storage
    .from(PROFILBILD_BUCKET)
    .upload(pfad, bytes, { contentType: `image/${treffer[1]}`, upsert: false });
  if (uploadFehler) return { ok: false, fehler: "Hochladen hat nicht geklappt." };

  const { data: alt } = await supabase.from("settings").select("avatar_pfad").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("settings").update({ avatar_pfad: pfad }).eq("user_id", user.id);
  if (error) {
    await supabase.storage.from(PROFILBILD_BUCKET).remove([pfad]);
    return { ok: false, fehler: "Speichern hat nicht geklappt." };
  }
  if (alt?.avatar_pfad) await supabase.storage.from(PROFILBILD_BUCKET).remove([alt.avatar_pfad]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function profilbildEntfernen(): Promise<Ergebnis> {
  const { supabase, user } = await angemeldet();
  const { data: alt } = await supabase.from("settings").select("avatar_pfad").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("settings").update({ avatar_pfad: null }).eq("user_id", user.id);
  if (error) return { ok: false, fehler: "Entfernen hat nicht geklappt." };
  if (alt?.avatar_pfad) await supabase.storage.from(PROFILBILD_BUCKET).remove([alt.avatar_pfad]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Neue E-Mail: Supabase schickt einen Bestätigungslink; erst danach gilt sie. */
export async function emailAendern(eingabe: string): Promise<Ergebnis> {
  const { supabase, user } = await angemeldet();
  const email = eingabe.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, fehler: "Bitte eine gültige E-Mail-Adresse eingeben." };
  if (email === user.email?.toLowerCase()) return { ok: false, fehler: "Das ist bereits deine E-Mail-Adresse." };
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${origin}/auth/callback?next=/einstellungen` });
  if (error) {
    if (error.code === "email_exists") return { ok: false, fehler: "Diese E-Mail-Adresse wird schon verwendet." };
    if (error.status === 429) return { ok: false, fehler: "Gerade wurden zu viele E-Mails verschickt. Bitte versuch es später noch einmal." };
    return { ok: false, fehler: "Die E-Mail-Adresse konnte nicht geändert werden." };
  }
  return { ok: true, hinweis: `Wir haben dir einen Bestätigungslink an ${email} geschickt. Je nach Einstellung musst du die Änderung auch in deinem bisherigen Postfach bestätigen.` };
}

/** Passwort ändern – nur mit dem aktuellen Passwort. */
export async function passwortAendern(aktuell: string, neu: string): Promise<Ergebnis> {
  const { supabase, user } = await angemeldet();
  if (typeof neu !== "string" || neu.length < 6) return { ok: false, fehler: "Das neue Passwort braucht mindestens 6 Zeichen." };
  if (!user.email) return { ok: false, fehler: "Für dieses Konto gibt es kein Passwort." };
  const { error: pruefFehler } = await supabase.auth.signInWithPassword({ email: user.email, password: aktuell });
  if (pruefFehler) return { ok: false, fehler: "Das aktuelle Passwort stimmt nicht." };
  const { error } = await supabase.auth.updateUser({ password: neu });
  if (error) {
    if (error.code === "same_password") return { ok: false, fehler: "Das neue Passwort ist dasselbe wie das alte." };
    if (error.code === "weak_password") return { ok: false, fehler: "Das Passwort ist zu schwach. Nimm ein längeres oder eins mit Ziffern und Zeichen." };
    return { ok: false, fehler: "Das Passwort konnte nicht geändert werden." };
  }
  return { ok: true, hinweis: "Dein Passwort wurde geändert." };
}
