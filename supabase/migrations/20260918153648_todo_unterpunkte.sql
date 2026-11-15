
alter table public.todo
  add column parent_id uuid references public.todo(id) on delete cascade;

create index todo_parent_id_idx on public.todo(parent_id);
