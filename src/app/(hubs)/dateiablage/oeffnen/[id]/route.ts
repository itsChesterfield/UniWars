import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Fester Link für angehängte Dateien (DAT-08): PDF -> PDF Reader, sonst kurzlebiger Storage-Link.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: datei } = await supabase.from("datei").select("id, name, mime_typ, speicher_pfad").eq("id", id).maybeSingle();
  if (!datei) return NextResponse.redirect(new URL("/dateiablage", request.url));
  if (datei.mime_typ === "application/pdf") return NextResponse.redirect(new URL(`/pdf-reader/${datei.id}`, request.url));
  const { data, error } = await supabase.storage.from("dateiablage").createSignedUrl(datei.speicher_pfad, 600);
  if (error || !data) return NextResponse.redirect(new URL("/dateiablage", request.url));
  return NextResponse.redirect(data.signedUrl);
}
