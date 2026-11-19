"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { semesterLage } from "@/lib/semester-server";
import type { SemesterTermine } from "@/lib/semester";
import type { Ergebnis } from "@/app/settings/actions";

const datum = (d: unknown): string | null => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

/** Termine für alle an derselben Hochschule speichern */
export async function semesterSpeichern(t: SemesterTermine): Promise<Ergebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const lage = await semesterLage(supabase, t.semester);
  if (!lage || !/^\d{4}[SW]$/.test(t.semester)) return { ok: false, fehler: "Wähle zuerst deine Hochschule." };
  const beginn = datum(t.vorlesung_beginn);
  const ende = datum(t.vorlesung_ende);
  if (!beginn || !ende || ende <= beginn) return { ok: false, fehler: "Vorlesungsbeginn und -ende prüfen." };
  const pBeginn = datum(t.pruefung_beginn);
  const pEnde = datum(t.pruefung_ende);
  if (pBeginn && pEnde && pEnde < pBeginn) return { ok: false, fehler: "Die Prüfungszeit endet vor ihrem Beginn." };
  const { error } = await supabase.from("hochschule_semester").upsert({
    hochschule_id: lage.hochschuleId,
    semester: t.semester,
    vorlesung_beginn: beginn,
    vorlesung_ende: ende,
    pruefung_beginn: pBeginn,
    pruefung_ende: pEnde,
    rueckmeldung_bis: datum(t.rueckmeldung_bis),
    geaendert_von: user.id,
    geaendert_am: new Date().toISOString(),
  });
  if (error) return { ok: false, fehler: "Speichern hat nicht geklappt." };
  revalidatePath("/einstellungen");
  revalidatePath("/");
  return { ok: true, hinweis: "Gespeichert. Das gilt jetzt für alle an deiner Hochschule." };
}

/** Rückmeldefrist als eigene Frist in „Aufgaben“ eintragen */
export async function rueckmeldungAlsFrist(): Promise<Ergebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const lage = await semesterLage(supabase);
  const bis = lage?.termine.rueckmeldung_bis;
  if (!bis) return { ok: false, fehler: "Für dieses Semester ist keine Rückmeldefrist eingetragen." };
  const titel = "Rückmeldung zum nächsten Semester";
  const faellig = new Date(`${bis}T21:59:00Z`).toISOString();
  const { data: vorhanden } = await supabase.from("deadline").select("id").eq("titel", titel).eq("faellig_am", faellig).maybeSingle();
  if (vorhanden) return { ok: true, hinweis: "Steht schon in deinen Aufgaben." };
  const { error } = await supabase.from("deadline").insert({ user_id: user.id, titel, faellig_am: faellig });
  if (error) return { ok: false, fehler: "Eintragen hat nicht geklappt." };
  revalidatePath("/");
  revalidatePath("/aufgaben");
  return { ok: true, hinweis: "In Aufgaben eingetragen." };
}
