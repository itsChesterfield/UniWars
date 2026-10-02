const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API_URL = "https://www.googleapis.com/calendar/v3";

// Nur eigener UniWars-Kalender (schreiben) + Frei/Belegt (lesen, ohne Inhalte).
export const SCOPE_EIGENER_KALENDER = "https://www.googleapis.com/auth/calendar.app.created";
export const SCOPE_FREI_BELEGT = "https://www.googleapis.com/auth/calendar.freebusy";
export const GOOGLE_SCOPES = [SCOPE_EIGENER_KALENDER, SCOPE_FREI_BELEGT];

export const ZEITZONE = "Europe/Berlin";
export const STATE_COOKIE = "kalender_oauth_state";

export class GoogleFehler extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function googleKonfiguriert(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.KALENDER_TOKEN_SCHLUESSEL,
  );
}

export function autorisierungsUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenAntwort = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

async function tokenAnfrage(body: Record<string, string>): Promise<TokenAntwort> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GoogleFehler(json.error_description ?? "Google-Token-Anfrage fehlgeschlagen", res.status, json.error);
  }
  return json as TokenAntwort;
}

export function codeEinloesen(code: string, redirectUri: string) {
  return tokenAnfrage({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function tokenErneuern(refreshToken: string) {
  return tokenAnfrage({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function tokenWiderrufen(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  }).catch(() => undefined);
}

export async function googleApi<T>(
  accessToken: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  pfad: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${pfad}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GoogleFehler(json.error?.message ?? `Google-API-Fehler ${res.status}`, res.status, json.error?.status);
  }
  return json as T;
}

export type BelegtBlock = { start: string; end: string };

export async function belegteZeiten(accessToken: string, vonIso: string, bisIso: string): Promise<BelegtBlock[]> {
  const antwort = await googleApi<{ calendars: Record<string, { busy?: BelegtBlock[] }> }>(
    accessToken,
    "POST",
    "/freeBusy",
    { timeMin: vonIso, timeMax: bisIso, timeZone: ZEITZONE, items: [{ id: "primary" }] },
  );
  return antwort.calendars?.primary?.busy ?? [];
}
