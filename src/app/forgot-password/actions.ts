"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function fehlerText(error: { message: string; code?: string; status?: number }) {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    const sekunden = error.message.match(/after (\d+) seconds/)?.[1];
    return sekunden
      ? `Du hast gerade schon einen Link angefordert. Bitte warte ${sekunden} Sekunden und schau solange auch im Spam-Ordner nach.`
      : "Gerade wurden zu viele E-Mails verschickt. Bitte versuche es in einer Stunde noch einmal und schau solange auch im Spam-Ordner nach.";
  }
  if (error.code === "email_address_invalid") return "Diese E-Mail-Adresse ist ungültig.";
  return "Der Link konnte nicht verschickt werden. Bitte versuche es später noch einmal.";
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(fehlerText(error))}`);
  }

  redirect("/forgot-password?sent=1");
}
