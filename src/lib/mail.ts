import "server-only";

/**
 * E-Mails über Resend (https://resend.com). Benötigt RESEND_API_KEY und MAIL_ABSENDER,
 * z. B. „UniVerse <noreply@deine-domain.de>“ – die Domain muss bei Resend bestätigt sein.
 */
export function mailKonfiguriert(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_ABSENDER);
}

export async function mailSenden({ an, betreff, text, html }: { an: string; betreff: string; text: string; html: string }): Promise<boolean> {
  if (!mailKonfiguriert()) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_ABSENDER, to: [an], subject: betreff, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
