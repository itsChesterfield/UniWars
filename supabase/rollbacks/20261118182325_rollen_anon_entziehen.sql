-- Rollback zu 20261118182325_rollen_anon_entziehen.sql
grant execute on function public.aktuelle_rolle() to anon;
grant execute on function public.hat_rolle(public.app_role) to anon;
