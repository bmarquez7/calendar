alter table public.events
add column if not exists recurrence_group_id uuid;

create index if not exists events_recurrence_group_idx
on public.events (recurrence_group_id, date_start);

notify pgrst, 'reload schema';
