-- Rollback zu 20261118185227_rollen.sql
drop function if exists public.hat_rolle(public.app_role);
drop function if exists public.aktuelle_rolle();
drop table if exists public.user_roles;
drop type if exists public.app_role;
