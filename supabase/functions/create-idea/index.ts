// Supabase Edge Function "create-idea" (Deno).
//
// Nimmt { title, description, hub } vom Browser entgegen, legt daraus in YouTrack ein Ticket
// im passenden Hub-Epic an und versieht es per Commands-API mit dem Tag "Rohidee".
//
// WICHTIG: Der YouTrack-Token liegt ausschliesslich hier als Supabase Secret YOUTRACK_TOKEN,
// niemals im Frontend. Ablauf: Browser -> diese Edge Function -> YouTrack REST API.
//
// Die Funktion laeuft mit JWT-Pruefung (Standard), also nur fuer angemeldete Nutzer.

const YOUTRACK_BASIS = "https://universebusiness.youtrack.cloud";
const PROJEKT_KEY = "FEA";

// Hub -> Epic. Nicht geheim, aber hier die massgebliche Quelle (Client schickt nur den Hub-Schluessel).
const HUB_EPIC: Record<string, string> = {
  dateiablage: "FEA-1",
  notizen: "FEA-2",
  karteikarten: "FEA-3",
  pdf: "FEA-4",
  workstation: "FEA-5",
  mindmap: "FEA-6",
  whiteboard: "FEA-7",
  literatur: "FEA-8",
  textverarbeitung: "FEA-9",
  praesentationen: "FEA-10",
  tabellen: "FEA-11",
  transkription: "FEA-12",
  chat: "FEA-13",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// YouTrack-Permanent-Token: funktioniert, egal ob das Secret den Praefix "perm:"/"perm-" schon enthaelt.
function authHeader(token: string): string {
  const t = token.trim();
  const wert = t.startsWith("perm:") || t.startsWith("perm-") ? t : `perm:${t}`;
  return `Bearer ${wert}`;
}

// Die interne Projekt-Id zum Key FEA; einmal pro warmer Instanz ermittelt.
let projektIdCache: string | null = null;
async function projektId(auth: string): Promise<string> {
  if (projektIdCache) return projektIdCache;
  const res = await fetch(`${YOUTRACK_BASIS}/api/admin/projects?fields=id,shortName&query=${PROJEKT_KEY}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Projektsuche fehlgeschlagen (${res.status}).`);
  const liste = (await res.json()) as Array<{ id: string; shortName: string }>;
  const treffer = liste.find((p) => p.shortName === PROJEKT_KEY);
  if (!treffer) throw new Error(`Projekt ${PROJEKT_KEY} nicht gefunden.`);
  projektIdCache = treffer.id;
  return treffer.id;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  const token = Deno.env.get("YOUTRACK_TOKEN");
  if (!token) return json({ error: "YOUTRACK_TOKEN ist nicht gesetzt." }, 500);
  const auth = authHeader(token);

  let daten: { title?: unknown; description?: unknown; hub?: unknown };
  try {
    daten = await req.json();
  } catch {
    return json({ error: "Ungueltige Anfrage." }, 400);
  }

  const title = typeof daten.title === "string" ? daten.title.trim() : "";
  const description = typeof daten.description === "string" ? daten.description.trim() : "";
  const hub = typeof daten.hub === "string" ? daten.hub : "";
  const epic = HUB_EPIC[hub];

  if (!title) return json({ error: "Titel fehlt." }, 400);
  if (!epic) return json({ error: `Unbekannter Bereich: ${hub}` }, 400);

  try {
    const pid = await projektId(auth);

    // 1) Ticket anlegen (Projekt FEA, summary, description). Prioritaet und Assignee bleiben Standard.
    const erstellen = await fetch(`${YOUTRACK_BASIS}/api/issues?fields=id,idReadable`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ project: { id: pid }, summary: title, description }),
    });
    if (!erstellen.ok) {
      const text = await erstellen.text();
      return json({ error: `YouTrack lehnte das Anlegen ab (${erstellen.status}).`, detail: text.slice(0, 500) }, 502);
    }
    const ticket = (await erstellen.json()) as { id: string; idReadable: string };

    // 2) Hub-Epic als Elternticket setzen und Tag "Rohidee" anwenden.
    const befehl = await fetch(`${YOUTRACK_BASIS}/api/commands`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: `subtask of ${epic} tag Rohidee`, issues: [{ id: ticket.id }] }),
    });
    if (!befehl.ok) {
      const text = await befehl.text();
      return json(
        {
          error: `Ticket ${ticket.idReadable} angelegt, aber Epic oder Tag schlug fehl (${befehl.status}). Existiert der Tag "Rohidee"?`,
          detail: text.slice(0, 500),
          issue: ticket.idReadable,
        },
        502,
      );
    }

    return json({ ok: true, issue: ticket.idReadable });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler." }, 502);
  }
});
