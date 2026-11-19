import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { istMaterialId } from "@/lib/dateiablage/material";
import { istWebLink } from "@/lib/dateiablage/weblink";

// Fester Link für angehängte Dateien (DAT-08): PDF -> PDF Reader, sonst kurzlebiger Storage-Link.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;
  if (!user || !istMaterialId(id)) return new Response(null, { status: 404 });
  const { data: datei } = await supabase.from("datei").select("id, name, mime_typ, speicher_pfad").eq("id", id).maybeSingle();
  if (!datei) return NextResponse.redirect(new URL("/dateiablage", request.url));
  if (datei.mime_typ === "application/pdf") return NextResponse.redirect(new URL(`/pdf-reader/${datei.id}`, request.url));
  const pfad = istWebLink(datei) ? "weblink" : "inhalt";
  return NextResponse.redirect(new URL(`/dateiablage/${pfad}/${datei.id}`, request.url));
}
