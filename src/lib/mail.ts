import "server-only";
import nodemailer from "nodemailer";

/**
 * E-Mails verschicken – drei Wege, in dieser Reihenfolge:
 * 1. Microsoft 365 (Graph, keine eigene Domain nötig): MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
 *    MS_ABSENDER (Postfach, z. B. name@firma.onmicrosoft.com). Die Entra-App braucht „Mail.Send“ (Anwendung).
 * 2. SMTP, z. B. Gmail mit App-Passwort: SMTP_USER, SMTP_PASS, optional SMTP_HOST (smtp.gmail.com), SMTP_PORT (465)
 * 3. Resend mit eigener, bestätigter Domain: RESEND_API_KEY und MAIL_ABSENDER
 */
const graphKonfiguriert = () => Boolean(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MS_ABSENDER);
const smtpKonfiguriert = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const resendKonfiguriert = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_ABSENDER);

export function mailKonfiguriert(): boolean {
  return graphKonfiguriert() || smtpKonfiguriert() || resendKonfiguriert();
}

type Mail = { an: string; betreff: string; text: string; html: string };

let graphToken: { wert: string; bis: number } | null = null;

async function graphZugang(): Promise<string> {
  if (graphToken && graphToken.bis > Date.now() + 60_000) return graphToken.wert;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_TENANT_ID!)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const d = (await r.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!r.ok || !d?.access_token) throw new Error(`Microsoft-Anmeldung: ${r.status} ${d?.error_description?.split("\r")[0] ?? ""}`);
  graphToken = { wert: d.access_token, bis: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return graphToken.wert;
}

async function perGraph({ an, betreff, html }: Mail): Promise<boolean> {
  const token = await graphZugang();
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.MS_ABSENDER!)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { subject: betreff, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: an } }] },
      saveToSentItems: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) console.error("Microsoft Graph:", r.status, (await r.text().catch(() => "")).slice(0, 300));
  return r.ok;
}

async function perSmtp({ an, betreff, text, html }: Mail): Promise<boolean> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  // Gmail verschickt nur im Namen des eigenen Kontos – der Anzeigename ist frei
  const konto = process.env.SMTP_USER!;
  const absender = process.env.MAIL_ABSENDER?.includes(konto) ? process.env.MAIL_ABSENDER : `UniVerse <${konto}>`;
  await transport.sendMail({ from: absender, to: an, subject: betreff, text, html });
  return true;
}

async function perResend({ an, betreff, text, html }: Mail): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_ABSENDER, to: [an], subject: betreff, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) console.error("Resend:", r.status, await r.text().catch(() => ""));
  return r.ok;
}

export async function mailSenden(mail: Mail): Promise<boolean> {
  try {
    if (graphKonfiguriert()) return await perGraph(mail);
    if (smtpKonfiguriert()) return await perSmtp(mail);
    if (resendKonfiguriert()) return await perResend(mail);
    return false;
  } catch (err) {
    console.error("Mail konnte nicht verschickt werden:", err instanceof Error ? err.message : err);
    return false;
  }
}
