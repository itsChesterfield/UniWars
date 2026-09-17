"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Der Link ist abgelaufen. Bitte erneut anfordern.")}`,
    );
  }

  const password = formData.get("password") as string;
  const passwordWiederholung = formData.get("password-wiederholung") as string;

  if (password !== passwordWiederholung) {
    redirect(`/reset-password?error=${encodeURIComponent("Die Passwörter stimmen nicht überein.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
