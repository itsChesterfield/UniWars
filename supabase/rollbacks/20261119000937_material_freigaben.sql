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

drop function private.material_geteilt(text, uuid, boolean);
drop function private.material_paket_mitglied(uuid, uuid);
drop function private.material_paket_recht(uuid, boolean, boolean);
drop function private.material_gruppe(uuid, uuid);
