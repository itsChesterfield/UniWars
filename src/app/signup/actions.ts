"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const username = (formData.get("username") as string).trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    redirect(
      `/signup?error=${encodeURIComponent("Nutzername muss 3–20 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstriche enthalten.")}`,
    );
  }

  const { data: verfuegbar, error: verfuegbarError } = await supabase.rpc(
    "ist_username_verfuegbar",
    { p_username: username },
  );
  if (verfuegbarError) {
    redirect(`/signup?error=${encodeURIComponent(verfuegbarError.message)}`);
  }
  if (!verfuegbar) {
    redirect(`/signup?error=${encodeURIComponent("Dieser Nutzername ist bereits vergeben.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    const nachricht = error.message.includes("USERNAME_TAKEN")
      ? "Dieser Nutzername ist bereits vergeben."
      : error.message;
    redirect(`/signup?error=${encodeURIComponent(nachricht)}`);
  }

  revalidatePath("/", "layout");

  // Falls die Supabase-Projekteinstellungen eine E-Mail-Bestätigung verlangen,
  // gibt signUp keine Session zurück - dann kann nicht direkt eingeloggt werden.
  if (!data.session) {
    redirect("/signup?check-email=1");
  }

  redirect("/");
}
