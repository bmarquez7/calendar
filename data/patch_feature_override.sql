alter table public.events
add column if not exists feature_override boolean not null default false;

notify pgrst, 'reload schema';
