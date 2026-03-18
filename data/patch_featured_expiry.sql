alter table public.events
add column if not exists is_highlighted boolean not null default false;

create index if not exists events_expiry_idx
on public.events ((coalesce(date_end, date_start)));

create index if not exists events_highlight_idx
on public.events (is_highlighted, created_at desc);
