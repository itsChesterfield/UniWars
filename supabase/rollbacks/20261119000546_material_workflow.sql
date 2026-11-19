drop policy material_quiz_aktiv on public.quiz_versuch;

alter table public.datei drop column pdf_index_status;
drop function public.material_thema_vorschlag(uuid, text, jsonb);
drop function public.material_themen_sortieren(uuid, uuid[]);

drop policy material_pdf_text_aktiv on public.quelle_seite;
drop policy material_transkript_aktiv on public.transkript_teil;
drop policy material_stapel_aktiv on public.kk_karte;
do $$
declare tabelle text;
begin
  foreach tabelle in array array['datei','notiz','kk_stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur_quelle'] loop
    execute pg_catalog.format('drop policy material_aktiv on public.%I', tabelle);
  end loop;
end
$$;
alter table public.material_ablage_fach drop column thema_id;
drop table public.material_thema, public.material_verknuepfung, public.material_ablage_info;
drop function private.material_ziel_sichtbar(text, uuid);
drop function private.material_aktiv(text, uuid);
drop function private.material_ist_meins(text, uuid);
drop function private.material_besitzt(text, uuid, uuid);
