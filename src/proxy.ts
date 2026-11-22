import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Statische Dateien der installierbaren App und der Landingpage sind öffentlich.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|universe-landing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
