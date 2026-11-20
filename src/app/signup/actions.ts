"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adresse, registrierFehler } from "@/lib/anmeldung";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const username = ((formData.get("username") as string | null) ?? "").trim().toLowerCase();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  // Bei einem Fehler bleiben Nutzername und E-Mail stehen (das Passwort nie in der Adresse)
  const zurueck = (fehler: string, feld: string | null) =>
    adresse("/signup", { fehler, feld, nutzername: username, email });

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    redirect(zurueck("Nimm 3 bis 20 Zeichen: a bis z, Ziffern und Unterstrich.", "nutzername"));
  }

  const { data: verfuegbar, error: verfuegbarError } = await supabase.rpc("ist_username_verfuegbar", {
    p_username: username,
  });
  if (verfuegbarError) redirect(zurueck("Der Nutzername konnte nicht geprüft werden. Bitte versuch es gleich noch einmal.", null));
  if (!verfuegbar) redirect(zurueck("Dieser Nutzername ist schon vergeben.", "nutzername"));

  const { data, error } = await supabase.auth.signUp({
    email,
    password: formData.get("password") as string,
    options: { data: { username } },
  });

  if (error) {
    const f = registrierFehler(error);
    redirect(zurueck(f.text, f.feld));
  }

  revalidatePath("/", "layout");

  // Mit E-Mail-Bestätigung gibt signUp keine Session zurück: zurück ins Anmeldefenster,
  // dort steht die kurze Meldung „Bestätige noch deine E-Mail“ (Entscheidung Didi, 18.11.).
  // Eine schon registrierte E-Mail landet bewusst genauso (AGENTS.md 3.6: nichts verraten).
  if (!data.session) redirect(adresse("/login", { bestaetigen: "1", email }));

  redirect("/");
}
