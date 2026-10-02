import { after, NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClientMitToken } from "@/lib/supabase/token-client";
import {
  STATE_COOKIE,
  SCOPE_EIGENER_KALENDER,
  SCOPE_FREI_BELEGT,
  codeEinloesen,
  googleKonfiguriert,
  tokenWiderrufen,
} from "@/lib/kalender/google";
import { verschluesseln } from "@/lib/kalender/krypto";
import { uniwarsKalenderAnlegen, vollAbgleich } from "@/lib/kalender/abgleich";

function zurueck(request: NextRequest, status: string) {
  const antwort = NextResponse.redirect(new URL(`/?kalender=${status}`, request.url));
  antwort.cookies.delete({ name: STATE_COOKIE, path: "/kalender/google" });
  return antwort;
}

export async function GET(request: NextRequest) {
  if (!googleKonfiguriert()) return zurueck(request, "nicht-eingerichtet");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return zurueck(request, "abgebrochen");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) {
    return zurueck(request, "fehler");
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const redirectUri = new URL("/kalender/google/callback", request.url).toString();
    const tokens = await codeEinloesen(code, redirectUri);
    const erteilt = (tokens.scope ?? "").split(" ");
    if (!erteilt.includes(SCOPE_EIGENER_KALENDER) || !erteilt.includes(SCOPE_FREI_BELEGT)) {
      await tokenWiderrufen(tokens.access_token);
      return zurueck(request, "rechte-fehlen");
    }
    if (!tokens.refresh_token) return zurueck(request, "fehler");

    const kalenderId = await uniwarsKalenderAnlegen(tokens.access_token);
    const { error } = await supabase.from("kalender_verbindung").upsert({
      user_id: session.user.id,
      anbieter: "google",
      refresh_token: verschluesseln(tokens.refresh_token),
      access_token: verschluesseln(tokens.access_token),
      access_token_ablauf: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      kalender_id: kalenderId,
      zuletzt_abgeglichen: null,
    });
    if (error) throw new Error(error.message);
    await supabase.from("kalender_eintrag").delete().eq("user_id", session.user.id);

    const accessToken = session.access_token;
    const userId = session.user.id;
    after(async () => {
      try {
        await vollAbgleich(createClientMitToken(accessToken), userId);
      } catch (err) {
        console.error("Erster Kalender-Abgleich fehlgeschlagen", err);
      }
    });

    return zurueck(request, "verbunden");
  } catch (err) {
    console.error("Google-Kalender verbinden fehlgeschlagen", err);
    return zurueck(request, "fehler");
  }
}
