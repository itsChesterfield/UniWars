import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Ohne Anmeldung erreichbar
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/", "/datenschutz"];
// Eingeloggte Nutzer werden von hier zum Dashboard geschickt
const NUR_GAESTE = ["/login", "/signup", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const pageRequest = request.method === "GET" || request.method === "HEAD";
  if (pathname === "/landing" && pageRequest) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims prüft das Token lokal (asymmetrische Signatur, Schlüssel werden zwischengespeichert)
  // statt bei jeder Anfrage den Auth-Server zu fragen – spart pro Seitenwechsel einen Netzwerkweg.
  // Abgelaufene Sitzungen werden dabei wie bisher erneuert und als Cookie zurückgeschrieben.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  // Bestehende Hub-Links sollen auch ohne Sitzung zur Anmeldung führen.
  const opensHub = ["detail", "anordnen", "kalender"].some((key) => searchParams.has(key));
  if (!user && pathname === "/" && pageRequest && !opensHub) {
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = "/landing";
    const response = NextResponse.rewrite(landingUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // E-Mail-Links (/auth/…) und /datenschutz bleiben auch mit Sitzung erreichbar.
  const opensDashboard = pathname === "/dashboard" && pageRequest;
  if (user && (opensDashboard || NUR_GAESTE.some((path) => pathname.startsWith(path)))) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/";
    const response = NextResponse.redirect(dashboardUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  return supabaseResponse;
}
