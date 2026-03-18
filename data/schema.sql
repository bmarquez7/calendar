-- Supabase SQL schema for Tirana Events Calendar

create extension if not exists "uuid-ossp";

create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'pending',
  title_en text not null,
  title_es text,
  title_sq text,
  description_en text not null,
  description_es text,
  description_sq text,
  location_en text,
  location_es text,
  location_sq text,
  event_type text not null,
  area text not null,
  event_language text[] not null,
  date_start timestamptz not null,
  date_end timestamptz,
  price_type text not null,
  price_min numeric,
  price_max numeric,
  currency text default 'ALL',
  ticket_url text,
  event_image_url text,
  is_highlighted boolean not null default false,
  organizer_name text,
  organizer_email text,
  submitter_name text,
  submitter_email text,
  submitter_note text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  hero_title_en text,
  hero_title_es text,
  hero_title_sq text,
  hero_subtitle_en text,
  hero_subtitle_es text,
  hero_subtitle_sq text,
  featured_title_en text,
  featured_title_es text,
  featured_title_sq text,
  featured_placeholder_image_url text,
  widget_theme jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists events_expiry_idx
on public.events ((coalesce(date_end, date_start)));

create index if not exists events_highlight_idx
on public.events (is_highlighted, created_at desc);

create table if not exists public.admin_user_roles (
  user_id uuid primary key,
  email text,
  role text not null check (role in ('moderator', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.admin_user_roles
  where user_id = auth.uid()
  order by case role
    when 'owner' then 3
    when 'editor' then 2
    when 'moderator' then 1
    else 0
  end desc
  limit 1;
$$;

create or replace function public.has_admin_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_admin_role()
    when 'owner' then 3
    when 'editor' then 2
    when 'moderator' then 1
    else 0
  end >= case required_role
    when 'owner' then 3
    when 'editor' then 2
    when 'moderator' then 1
    else 99
  end;
$$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_events_updated_at
before update on public.events
for each row execute procedure public.set_updated_at();

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
before update on public.site_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists set_admin_user_roles_updated_at on public.admin_user_roles;
create trigger set_admin_user_roles_updated_at
before update on public.admin_user_roles
for each row execute procedure public.set_updated_at();

-- Row Level Security
alter table public.events enable row level security;

-- Anyone can read approved events
drop policy if exists "Public read approved" on public.events;
create policy "Public read approved" on public.events
for select using (status = 'approved');

-- Authenticated admins can read all events (including pending)
drop policy if exists "Admin read all" on public.events;
create policy "Admin read all" on public.events
for select to authenticated using (public.has_admin_role('moderator'));

-- Anyone can insert (submissions go to pending)
drop policy if exists "Public insert" on public.events;
drop policy if exists "Anon submit pending" on public.events;
create policy "Anon submit pending" on public.events
for insert to anon with check (status = 'pending');

drop policy if exists "Authenticated submit pending or admin insert" on public.events;
create policy "Authenticated submit pending or admin insert" on public.events
for insert to authenticated with check (public.has_admin_role('editor') or status = 'pending');

drop policy if exists "Admin update" on public.events;
create policy "Admin update" on public.events
for update to authenticated using (public.has_admin_role('moderator')) with check (public.has_admin_role('moderator'));

drop policy if exists "Admin delete" on public.events;
create policy "Admin delete" on public.events
for delete to authenticated using (public.has_admin_role('editor'));

grant select, insert on public.events to anon, authenticated;
grant update, delete on public.events to authenticated;

alter table public.site_settings enable row level security;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings" on public.site_settings
for select using (true);

drop policy if exists "Owner upsert site settings" on public.site_settings;
drop policy if exists "Authenticated upsert site settings" on public.site_settings;
create policy "Owner upsert site settings" on public.site_settings
for insert to authenticated with check (public.has_admin_role('owner'));

drop policy if exists "Owner update site settings" on public.site_settings;
drop policy if exists "Authenticated update site settings" on public.site_settings;
create policy "Owner update site settings" on public.site_settings
for update to authenticated using (public.has_admin_role('owner')) with check (public.has_admin_role('owner'));

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

alter table public.admin_user_roles enable row level security;

drop policy if exists "Authenticated read roles" on public.admin_user_roles;
drop policy if exists "Editor read roles" on public.admin_user_roles;
create policy "Editor read roles" on public.admin_user_roles
for select to authenticated using (auth.uid() = user_id or public.has_admin_role('editor'));

drop policy if exists "Owner insert roles" on public.admin_user_roles;
drop policy if exists "Authenticated insert roles" on public.admin_user_roles;
create policy "Owner insert roles" on public.admin_user_roles
for insert to authenticated with check (public.has_admin_role('owner'));

drop policy if exists "Owner update roles" on public.admin_user_roles;
drop policy if exists "Authenticated update roles" on public.admin_user_roles;
create policy "Owner update roles" on public.admin_user_roles
for update to authenticated using (public.has_admin_role('owner')) with check (public.has_admin_role('owner'));

drop policy if exists "Owner delete roles" on public.admin_user_roles;
drop policy if exists "Authenticated delete roles" on public.admin_user_roles;
create policy "Owner delete roles" on public.admin_user_roles
for delete to authenticated using (public.has_admin_role('owner'));

grant select, insert, update, delete on public.admin_user_roles to authenticated;
grant execute on function public.current_admin_role() to anon, authenticated;
grant execute on function public.has_admin_role(text) to anon, authenticated;
