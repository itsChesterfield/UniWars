-- Gleich lange Domain bei mehreren Einrichtungen (z. B. Teilschulen): die Hauptinstitution mit kürzerem Namen gewinnt
create or replace function public.hochschule_zur_domain(p_domain text) returns text
language sql stable security definer set search_path = '' as $$
  select h.id
  from public.hochschule h, unnest(h.domains) d
  where lower(p_domain) = d or lower(p_domain) like '%.' || d
  order by length(d) desc, length(h.name)
  limit 1;
$$;
