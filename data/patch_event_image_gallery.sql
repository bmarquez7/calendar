alter table public.events
add column if not exists event_image_urls text[];

notify pgrst, 'reload schema';
