create or replace function public.datei_speicherlimit_pruefen() returns trigger
language plpgsql set search_path = '' as $$
declare v_belegt bigint;
begin
  select coalesce(sum(groesse), 0) into v_belegt from public.datei where user_id = new.user_id;
  if v_belegt + new.groesse > 2147483648 then
    raise exception 'SPEICHER_VOLL';
  end if;
  return new;
end;
$$;
grant execute on function public.datei_speicherlimit_pruefen() to public;
drop function public.material_speicherbelegung(), public.material_dateinamen(uuid, uuid);

drop policy material_pdf_stand_zugriff on public.pdf_stand;
alter policy pdf_stand_insert_eigene on public.pdf_stand with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.datei d where d.id = pdf_stand.datei_id and d.user_id = (select auth.uid()))
);
delete from public.pdf_stand s using public.datei d where s.datei_id = d.id and s.user_id <> d.user_id;
alter table public.pdf_stand drop constraint pdf_stand_pkey;
alter table public.pdf_stand add primary key (datei_id);
alter policy dateiablage_select_chat_anhang on storage.objects using (
  bucket_id = 'dateiablage' and exists (
    select 1 from public.chat_nachricht n where n.anhang ->> 'pfad' = storage.objects.name and not n.geloescht
  )
);
alter table public.datei drop constraint material_dateipfad_eigentuemer;

drop function public.material_paket_erstellen(uuid, text, jsonb);
alter policy material_ablage_fach_einfuegen on public.material_ablage_fach with check (
   user_id = (select auth.uid())
   and exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))
   and exists (select 1 from public.material_ablage_original m where m.art = material_ablage_fach.art and m.id = material_id and m.user_id = (select auth.uid()))
);
alter policy material_ablage_fach_aendern on public.material_ablage_fach with check (
   user_id = (select auth.uid())
   and exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))
   and exists (select 1 from public.material_ablage_original m where m.art = material_ablage_fach.art and m.id = material_id and m.user_id = (select auth.uid()))
);
drop policy material_karte_stapelrecht on public.kk_karte;
drop trigger material_karte_schuetzen on public.kk_karte;
drop function private.material_karte_schuetzen();
drop policy material_karte_geteilt_loeschen on public.kk_karte;
drop policy material_karte_geteilt_aendern on public.kk_karte;
drop policy material_karte_geteilt_anlegen on public.kk_karte;
drop policy material_karte_geteilt on public.kk_karte;
drop policy material_transkript_teil_geteilt on public.transkript_teil;
drop policy material_pdf_text_geteilt on public.quelle_seite;
do $$
declare tabelle text;
begin
  foreach tabelle in array array['datei','notiz','kk_stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur_quelle'] loop
    execute pg_catalog.format('drop trigger material_eigentuemer_schuetzen on public.%I', tabelle);
    execute pg_catalog.format('drop policy material_geteilt_aendern on public.%I', tabelle);
    execute pg_catalog.format('drop policy material_geteilt_lesen on public.%I', tabelle);
  end loop;
end
$$;
drop function private.material_eigentuemer_schuetzen();
drop policy material_info_geteilt on public.material_ablage_info;
drop policy material_datei_geteilt on storage.objects;
drop policy material_datei_aktiv on storage.objects;
drop table public.material_paket_pflege, public.material_paket_element, public.material_paket, public.material_freigabe;
drop function private.material_storage_aktiv(text);
drop function private.material_storage_geteilt(text);
drop policy material_medium_geteilt on public.datei;
drop function private.material_medium_geteilt(uuid);
drop function private.material_bildreferenzen(text, jsonb);

drop function private.material_geteilt(text, uuid, boolean);
drop function private.material_paket_mitglied(uuid, uuid);
drop function private.material_paket_recht(uuid, boolean, boolean);
drop function private.material_gruppe(uuid, uuid);
