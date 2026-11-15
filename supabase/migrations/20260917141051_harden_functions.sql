-- search_path fixieren
alter function notenschnitt() set search_path = public;

-- handle_new_user() ist nur für den auth-Trigger gedacht, nicht für die REST-API
revoke execute on function public.handle_new_user() from anon, authenticated, public;
