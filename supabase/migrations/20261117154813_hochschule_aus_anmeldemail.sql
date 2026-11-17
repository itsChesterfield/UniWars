-- Bei der Registrierung: Hochschule aus der Domain der Anmelde-Mail vorbelegen (max@stud.w-hs.de → w-hs.de)
create or replace function public.hochschule_zur_domain(p_domain text) returns text
language sql stable security definer set search_path = '' as $$
  select h.id
  from public.hochschule h, unnest(h.domains) d
  where lower(p_domain) = d or lower(p_domain) like '%.' || d
  order by length(d) desc
  limit 1;
$$;
revoke all on function public.hochschule_zur_domain(text) from public, anon;
grant execute on function public.hochschule_zur_domain(text) to authenticated;

create or replace function public.settings_hochschule_vorbelegen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_mail text;
begin
  if new.hochschule_id is null and new.hochschule_frei is null then
    select email into v_mail from auth.users where id = new.user_id;
    if v_mail like '%@%' then
      new.hochschule_id := public.hochschule_zur_domain(split_part(v_mail, '@', 2));
    end if;
  end if;
  return new;
end $$;
revoke all on function public.settings_hochschule_vorbelegen() from public, anon, authenticated;

create trigger settings_hochschule_vorbelegen before insert on public.settings
  for each row execute function public.settings_hochschule_vorbelegen();
