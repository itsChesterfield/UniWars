import { teamUpdatesLaden, teamUpdateZugriff } from "@/lib/team-updates-server";

export async function GET() {
  const client = await teamUpdateZugriff();
  if (!client) return new Response(null, { status: 404 });
  try {
    return Response.json(await teamUpdatesLaden(client, true), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function POST(request: Request) {
  const client = await teamUpdateZugriff();
  if (!client) return new Response(null, { status: 404 });
  const ids: unknown = await request.json().catch(() => null);
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 ||
    !ids.every((id: unknown) => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 2147483647)) {
    return new Response(null, { status: 400 });
  }
  // Das INSERT-Recht gilt nur für pr. user_id wird aus der Sitzung gesetzt.
  const { error } = await client.from("team_update_gelesen")
    .upsert([...new Set<number>(ids)].map((pr) => ({ pr })), { ignoreDuplicates: true });
  return new Response(null, { status: error ? 503 : 204 });
}
