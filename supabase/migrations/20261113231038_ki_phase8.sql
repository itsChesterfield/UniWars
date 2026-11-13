-- KI-11: Herkunft einer Karteikarte (aus welcher Notiz sie per KI-01 entstand)
alter table public.kk_karte
  add column quelle_notiz_id uuid null references public.notiz(id) on delete set null;

create index kk_karte_quelle_notiz_idx on public.kk_karte (quelle_notiz_id) where quelle_notiz_id is not null;
