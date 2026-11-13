import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// CHAT-04: angehängte Datei öffnen – nur Chat-Mitglieder sehen die Nachricht (RLS),
// und der Storage erlaubt Mitgliedern genau diese Datei.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: nachricht } = await supabase.from("chat_nachricht").select("anhang, geloescht").eq("id", id).maybeSingle();
  const pfad = (nachricht?.anhang as { pfad?: string } | null)?.pfad;
  if (!nachricht || nachricht.geloescht || !pfad) return NextResponse.redirect(new URL("/chat", request.url));
  const { data, error } = await supabase.storage.from("dateiablage").createSignedUrl(pfad, 600);
  if (error || !data) return NextResponse.redirect(new URL("/chat", request.url));
  return NextResponse.redirect(data.signedUrl);
}
