-- Role model for admin panel
create table if not exists public.admin_user_roles (
  user_id uuid primary key,
  email text,
  role text not null check (role in ('moderator', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_user_roles enable row level security;

drop policy if exists "Authenticated read roles" on public.admin_user_roles;
create policy "Authenticated read roles" on public.admin_user_roles
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated insert roles" on public.admin_user_roles;
create policy "Authenticated insert roles" on public.admin_user_roles
for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated update roles" on public.admin_user_roles;
create policy "Authenticated update roles" on public.admin_user_roles
for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated delete roles" on public.admin_user_roles;
create policy "Authenticated delete roles" on public.admin_user_roles
for delete using (auth.role() = 'authenticated');

grant select, insert, update, delete on public.admin_user_roles to authenticated;

-- Ensure site settings table exists for owner customization
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
  updated_at timestamptz not null default now()
);

-- Seed your owner (replace email if needed)
-- Note: run this once after first owner signs in at least once.
-- select id,email from auth.users where email='you@example.com';
-- insert into public.admin_user_roles(user_id,email,role)
-- values ('<USER_UUID>','you@example.com','owner')
-- on conflict (user_id) do update set role='owner', email=excluded.email;
