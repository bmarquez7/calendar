alter table public.events
add column if not exists feature_blocked boolean not null default false;

notify pgrst, 'reload schema';
