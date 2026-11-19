import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// CHAT-04: angehängte Datei öffnen – nur Chat-Mitglieder sehen die Nachricht (RLS),
// und der Storage erlaubt Mitgliedern genau diese Datei.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 404 });
  const { id } = await params;
  const { data: nachricht } = await supabase.from("chat_nachricht").select("anhang, geloescht").eq("id", id).maybeSingle();
  const anhang = nachricht?.anhang as { pfad?: string; typ?: string; titel?: string } | null;
  if (!nachricht || nachricht.geloescht || anhang?.typ !== "datei" || !anhang.pfad) return NextResponse.redirect(new URL("/chat", request.url));
  const { data, error } = await supabase.storage.from("dateiablage").download(anhang.pfad);
  if (error || !data) return NextResponse.redirect(new URL("/chat", request.url));
  const name = encodeURIComponent((anhang.titel ?? "Anhang").replace(/[\uD800-\uDFFF]/g, "_")).replace(/['()*]/g, (x) => `%${x.charCodeAt(0).toString(16)}`);
  return new Response(data, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${name}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
