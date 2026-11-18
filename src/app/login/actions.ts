"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adresse, anmeldeFehler, sendeFehler } from "@/lib/anmeldung";

function emailAus(formData: FormData) {
  return ((formData.get("email") as string | null) ?? "").trim();
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = emailAus(formData);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get("password") as string,
  });

  if (error) {
    const f = anmeldeFehler(error);
    // Noch nicht bestätigt: dieselbe ruhige Meldung wie nach dem Registrieren, mit „Erneut senden“
    if (f.art === "unbestaetigt") redirect(adresse("/login", { bestaetigen: "offen", email }));
    redirect(adresse("/login", { error: f.text, email }));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** Bestätigungsmail noch einmal schicken (Knopf in der Meldung des Anmeldefensters) */
export async function bestaetigungErneutSenden(formData: FormData) {
  const email = emailAus(formData);
  if (!email) redirect(adresse("/login", { error: "Trag zuerst deine E-Mail-Adresse ein.", bestaetigen: "offen" }));

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) redirect(adresse("/login", { error: sendeFehler(error), bestaetigen: "offen", email }));

  redirect(adresse("/login", { bestaetigen: "gesendet", email }));
}
