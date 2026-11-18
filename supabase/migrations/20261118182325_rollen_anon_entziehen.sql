-- Advisor-Hinweis 0028: Rollen-Funktionen ohne Anmeldung nicht aufrufbar machen.
-- Angemeldete Nutzer brauchen sie weiterhin (Badges, RLS anderer Tabellen).
revoke execute on function public.aktuelle_rolle() from public, anon;
revoke execute on function public.hat_rolle(public.app_role) from public, anon;
grant execute on function public.aktuelle_rolle() to authenticated, service_role;
grant execute on function public.hat_rolle(public.app_role) to authenticated, service_role;
