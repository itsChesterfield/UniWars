-- Beim ersten Login/Registrierung automatisch eine settings-Zeile anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gewichteter Notenschnitt
create or replace function notenschnitt()
returns numeric
language sql stable
as $$
  select round(sum(wert * gewicht) / nullif(sum(gewicht), 0), 1)
  from note
  where user_id = auth.uid();
$$;
