alter table public.site_settings
add column if not exists widget_theme jsonb;
