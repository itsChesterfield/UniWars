import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Bestätigungs-Links aus E-Mails (Passwort zurücksetzen, Registrierung).
 * Anders als /auth/callback (PKCE-Code) funktioniert der token_hash auch,
 * wenn der Link auf einem anderen Gerät oder in der Mail-App geöffnet wird.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : type === "recovery" ? "/reset-password" : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const ziel = type === "recovery" ? "/forgot-password" : "/login";
  return NextResponse.redirect(
    `${origin}${ziel}?error=${encodeURIComponent("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.")}`,
  );
}
