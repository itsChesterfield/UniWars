import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, autorisierungsUrl, googleKonfiguriert } from "@/lib/kalender/google";

export async function GET(request: NextRequest) {
  if (!googleKonfiguriert()) {
    return NextResponse.redirect(new URL("/?kalender=nicht-eingerichtet", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/kalender/google/callback", request.url).toString();
  const antwort = NextResponse.redirect(autorisierungsUrl(redirectUri, state));
  antwort.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/kalender/google",
    maxAge: 600,
  });
  return antwort;
}
