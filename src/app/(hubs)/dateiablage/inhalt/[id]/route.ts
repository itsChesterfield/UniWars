import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiTyp } from "@/lib/dateiablage/dateien";
import { istMaterialId } from "@/lib/dateiablage/material";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;
  if (!user || !istMaterialId(id)) return new Response(null, { status: 404 });
  const { data } = await supabase.from("datei").select("name, speicher_pfad, mime_typ").eq("id", id).maybeSingle();
  if (!data) return new Response(null, { status: 404 });
  const { data: datei, error } = await supabase.storage.from("dateiablage").download(data.speicher_pfad);
  if (error || !datei) return new Response(null, { status: 404 });
  const typ = dateiTyp(data.name);
  const download = request.nextUrl.searchParams.has("download") || !typ || typ.art === "office";
  const name = encodeURIComponent(data.name.replace(/[\uD800-\uDFFF]/g, "_")).replace(/['()*]/g, (x) => `%${x.charCodeAt(0).toString(16)}`);
  const header = new Headers({
    "content-type": typ?.mime === data.mime_typ ? data.mime_typ : "application/octet-stream",
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
  });
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) {
    header.set("content-length", String(datei.size));
    return new Response(datei, { headers: header });
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, datei.size - Number(range[2]));
  const ende = range[1] && range[2] ? Math.min(Number(range[2]), datei.size - 1) : datei.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(ende) || start > ende || start >= datei.size) {
    header.set("content-range", `bytes */${datei.size}`);
    return new Response(null, { status: 416, headers: header });
  }
  header.set("content-range", `bytes ${start}-${ende}/${datei.size}`);
  header.set("content-length", String(ende - start + 1));
  return new Response(datei.slice(start, ende + 1), { status: 206, headers: header });
}
