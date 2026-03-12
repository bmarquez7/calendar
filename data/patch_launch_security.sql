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

alter table public.events enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_user_roles enable row level security;

drop policy if exists "Public read approved" on public.events;
create policy "Public read approved" on public.events
for select using (status = 'approved');

drop policy if exists "Admin read all" on public.events;
create policy "Admin read all" on public.events
for select to authenticated using (public.has_admin_role('moderator'));

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

grant select, insert on public.events to anon, authenticated;
grant update, delete on public.events to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant select, insert, update, delete on public.admin_user_roles to authenticated;
grant execute on function public.current_admin_role() to anon, authenticated;
grant execute on function public.has_admin_role(text) to anon, authenticated;
