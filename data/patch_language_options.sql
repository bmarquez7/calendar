create table if not exists public.language_options (
  code text primary key,
  label text not null,
  label_key text not null unique,
  sort_label text not null,
  created_at timestamptz not null default now()
);

alter table public.language_options enable row level security;

drop policy if exists "Public read language options" on public.language_options;
create policy "Public read language options" on public.language_options
for select using (true);

grant select on public.language_options to anon, authenticated;

notify pgrst, 'reload schema';
