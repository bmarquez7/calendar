alter table public.events
add column if not exists admin_response_note text;

notify pgrst, 'reload schema';
