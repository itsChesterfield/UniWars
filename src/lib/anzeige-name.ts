/** Name für Begrüßung und Profil: Nutzername, sonst aus dem Signup, sonst vor dem @ der E-Mail. */
export function anzeigeName(
  settings: { username?: string | null } | null | undefined,
  user: { email?: string | null; user_metadata?: Record<string, unknown> | null },
): string {
  if (typeof settings?.username === "string" && settings.username.trim()) return settings.username;
  const ausSignup = user.user_metadata?.username;
  if (typeof ausSignup === "string" && ausSignup.trim()) return ausSignup;
  return (user.email ?? "").split("@")[0];
}
