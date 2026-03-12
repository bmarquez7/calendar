-- Role model and secure policies for admin panel

create table if not exists public.admin_user_roles (
  user_id uuid primary key,
  email text,
  role text not null check (role in ('moderator', 'editor', 'owner')),
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

alter table public.admin_user_roles enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Editor read roles" on public.admin_user_roles;
drop policy if exists "Authenticated read roles" on public.admin_user_roles;
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

grant select, insert, update, delete on public.admin_user_roles to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant execute on function public.current_admin_role() to anon, authenticated;
grant execute on function public.has_admin_role(text) to anon, authenticated;

-- Seed your owner after the first sign-in:
-- select id,email from auth.users where email='you@example.com';
-- insert into public.admin_user_roles(user_id,email,role)
-- values ('<USER_UUID>','you@example.com','owner')
-- on conflict (user_id) do update set role='owner', email=excluded.email;
