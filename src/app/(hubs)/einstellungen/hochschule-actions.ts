"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient, adminKonfiguriert } from "@/lib/supabase/admin";
import { mailKonfiguriert, mailSenden } from "@/lib/mail";
import {
  CODE_GUELTIG_MS,
  MAX_CODE_VERSUCHE,
  MAX_SENDUNGEN_PRO_STUNDE,
  VERIFIZIERUNG_GUELTIG_MS,
  domainAusMail,
  hochschuleZurMail,
  istMailAdresse,
  type HochschuleKurz,
} from "@/lib/hochschulen";
import type { Ergebnis } from "@/app/settings/actions";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

/** Alle Hochschulen für die Suche (ca. 1.000 – PostgREST liefert höchstens 1.000 je Abfrage) */
export async function hochschulenLaden(): Promise<HochschuleKurz[]> {
  const { supabase } = await nutzer();
  const spalten = "id, name, kurzname, ort, land, domains";
  const [a, b] = await Promise.all([
    supabase.from("hochschule").select(spalten).order("name").range(0, 999),
    supabase.from("hochschule").select(spalten).order("name").range(1000, 2999),
  ]);
  return [...(a.data ?? []), ...(b.data ?? [])];
}

export async function hochschuleSetzen(id: string | null, frei: string | null = null): Promise<Ergebnis> {
  const { supabase, user } = await nutzer();
  const freiText = frei?.replace(/\s+/g, " ").trim().slice(0, 160) || null;
  const { error } = await supabase
    .from("settings")
    .update({ hochschule_id: id, hochschule_frei: id ? null : freiText })
    .eq("user_id", user.id);
  if (error) return { ok: false, fehler: "Speichern hat nicht geklappt." };
  revalidatePath("/einstellungen");
  return { ok: true };
}

/** Hochschule zur Domain (inkl. Subdomains) aus der Datenbank */
async function hochschuleZurDomain(email: string) {
  const domain = domainAusMail(email);
  if (!domain) return null;
  const teile = domain.split(".");
  const kandidaten = teile.slice(0, -1).map((_, i) => teile.slice(i).join("."));
  const { supabase } = await nutzer();
  const { data } = await supabase.from("hochschule").select("id, name, domains").overlaps("domains", kandidaten);
  return hochschuleZurMail(email, data ?? []);
}

const hash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

export async function uniMailCodeSenden(email: string): Promise<Ergebnis> {
  const { user } = await nutzer();
  if (!adminKonfiguriert() || !mailKonfiguriert()) return { ok: false, fehler: "Die Bestätigung per Code ist noch nicht eingerichtet." };
  const adresse = email.trim().toLowerCase();
  if (!istMailAdresse(adresse)) return { ok: false, fehler: "Bitte eine gültige E-Mail-Adresse eingeben." };
  const hs = await hochschuleZurDomain(adresse);
  if (!hs) return { ok: false, fehler: "Diese Adresse gehört zu keiner bekannten Hochschule. Nutze deine Uni-Mail (z. B. name@stud.uni-xyz.de)." };

  const admin = adminClient();
  const { data: vergeben } = await admin
    .from("uni_verifizierung")
    .select("user_id")
    .ilike("email", adresse)
    .not("bestaetigt_am", "is", null)
    .neq("user_id", user.id)
    .maybeSingle();
  if (vergeben) return { ok: false, fehler: "Diese Uni-Mail ist schon mit einem anderen Konto bestätigt." };

  const { data: alt } = await admin.from("uni_verifizierung").select("gesendet_am").eq("user_id", user.id).maybeSingle();
  const jetzt = Date.now();
  const letzteStunde = (alt?.gesendet_am ?? []).filter((t) => jetzt - new Date(t).getTime() < 3_600_000);
  if (letzteStunde.length >= MAX_SENDUNGEN_PRO_STUNDE) return { ok: false, fehler: "Zu viele Codes angefordert. Bitte versuch es in einer Stunde noch einmal." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("uni_verifizierung").upsert({
    user_id: user.id,
    email: adresse,
    hochschule_id: hs.id,
    code_hash: hash(user.id, code),
    code_laeuft_ab: new Date(jetzt + CODE_GUELTIG_MS).toISOString(),
    versuche: 0,
    gesendet_am: [...letzteStunde, new Date(jetzt).toISOString()],
    bestaetigt_am: null,
    gueltig_bis: null,
  });
  if (error) return { ok: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." };

  const gesendet = await mailSenden({
    an: adresse,
    betreff: `${code} ist dein Bestätigungscode für UniVerse`,
    text: `Dein Code: ${code}\n\nGib ihn in UniVerse unter Einstellungen › Hochschule ein, um deine Uni-Mail (${hs.name}) zu bestätigen. Der Code gilt 15 Minuten.\n\nDu hast das nicht angefordert? Dann ignoriere diese Mail einfach.`,
    html: `<p>Dein Bestätigungscode für UniVerse:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Gib ihn unter <b>Einstellungen › Hochschule</b> ein, um deine Uni-Mail (${hs.name}) zu bestätigen. Der Code gilt 15 Minuten.</p><p style="color:#666">Du hast das nicht angefordert? Dann ignoriere diese Mail einfach.</p>`,
  });
  if (!gesendet) return { ok: false, fehler: "Die Mail konnte nicht verschickt werden. Bitte versuch es später noch einmal." };
  return { ok: true, hinweis: `Code an ${adresse} geschickt. Schau auch im Spam-Ordner nach.` };
}

async function bestaetigen(userId: string, email: string, hochschuleId: string | null) {
  const admin = adminClient();
  const jetzt = new Date();
  const { error } = await admin.from("uni_verifizierung").upsert({
    user_id: userId,
    email,
    hochschule_id: hochschuleId,
    code_hash: null,
    code_laeuft_ab: null,
    versuche: 0,
    bestaetigt_am: jetzt.toISOString(),
    gueltig_bis: new Date(jetzt.getTime() + VERIFIZIERUNG_GUELTIG_MS).toISOString(),
  });
  if (error) return false;
  // Hochschule im Profil übernehmen, falls noch keine gewählt ist
  if (hochschuleId) await admin.from("settings").update({ hochschule_id: hochschuleId, hochschule_frei: null }).eq("user_id", userId).is("hochschule_id", null);
  return true;
}

export async function uniMailBestaetigen(code: string): Promise<Ergebnis> {
  const { user } = await nutzer();
  if (!adminKonfiguriert()) return { ok: false, fehler: "Die Bestätigung ist noch nicht eingerichtet." };
  const eingabe = code.replace(/\D/g, "");
  const admin = adminClient();
  const { data: v } = await admin.from("uni_verifizierung").select("*").eq("user_id", user.id).maybeSingle();
  if (!v?.code_hash || !v.code_laeuft_ab) return { ok: false, fehler: "Fordere zuerst einen Code an." };
  if (new Date(v.code_laeuft_ab).getTime() < Date.now()) return { ok: false, fehler: "Der Code ist abgelaufen. Fordere einen neuen an." };
  if (v.versuche >= MAX_CODE_VERSUCHE) return { ok: false, fehler: "Zu viele falsche Versuche. Fordere einen neuen Code an." };

  const erwartet = Buffer.from(v.code_hash, "hex");
  const erhalten = Buffer.from(hash(user.id, eingabe), "hex");
  if (eingabe.length !== 6 || !timingSafeEqual(erwartet, erhalten)) {
    await admin.from("uni_verifizierung").update({ versuche: v.versuche + 1 }).eq("user_id", user.id);
    const rest = MAX_CODE_VERSUCHE - v.versuche - 1;
    return { ok: false, fehler: rest > 0 ? `Der Code stimmt nicht. Noch ${rest} ${rest === 1 ? "Versuch" : "Versuche"}.` : "Der Code stimmt nicht. Fordere einen neuen an." };
  }
  if (!(await bestaetigen(user.id, v.email, v.hochschule_id))) {
    return { ok: false, fehler: "Diese Uni-Mail ist schon mit einem anderen Konto bestätigt." };
  }
  revalidatePath("/einstellungen");
  return { ok: true, hinweis: "Uni-Mail bestätigt." };
}

/** Die Anmelde-Adresse ist schon von Supabase bestätigt – gehört sie zu einer Hochschule, reicht ein Klick. */
export async function anmeldeMailUebernehmen(): Promise<Ergebnis> {
  const { user } = await nutzer();
  if (!adminKonfiguriert()) return { ok: false, fehler: "Die Bestätigung ist noch nicht eingerichtet." };
  if (!user.email || !user.email_confirmed_at) return { ok: false, fehler: "Deine Anmelde-Adresse ist noch nicht bestätigt." };
  const hs = await hochschuleZurDomain(user.email);
  if (!hs) return { ok: false, fehler: "Deine Anmelde-Adresse gehört zu keiner bekannten Hochschule." };
  if (!(await bestaetigen(user.id, user.email.toLowerCase(), hs.id))) {
    return { ok: false, fehler: "Diese Uni-Mail ist schon mit einem anderen Konto bestätigt." };
  }
  revalidatePath("/einstellungen");
  return { ok: true, hinweis: `Bestätigt: ${hs.name}.` };
}

export async function uniMailEntfernen(): Promise<Ergebnis> {
  const { user } = await nutzer();
  if (!adminKonfiguriert()) return { ok: false, fehler: "Die Bestätigung ist noch nicht eingerichtet." };
  const { error } = await adminClient().from("uni_verifizierung").delete().eq("user_id", user.id);
  if (error) return { ok: false, fehler: "Das hat nicht geklappt." };
  revalidatePath("/einstellungen");
  return { ok: true, hinweis: "Uni-Mail entfernt." };
}
