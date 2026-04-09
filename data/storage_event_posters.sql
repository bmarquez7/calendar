insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

drop policy if exists "Public can upload posters" on storage.objects;
drop policy if exists "Public can upload submission posters" on storage.objects;
create policy "Public can upload submission posters"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'event-posters'
  and name like 'public-batch/%'
);

drop policy if exists "Authenticated can upload posters" on storage.objects;
create policy "Authenticated can upload posters"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'event-posters');

drop policy if exists "Public can read posters" on storage.objects;
create policy "Public can read posters"
on storage.objects
for select
to public
using (bucket_id = 'event-posters');

drop policy if exists "Authenticated can update posters" on storage.objects;
create policy "Authenticated can update posters"
on storage.objects
for update
to authenticated
using (bucket_id = 'event-posters')
with check (bucket_id = 'event-posters');

drop policy if exists "Authenticated can delete posters" on storage.objects;
create policy "Authenticated can delete posters"
on storage.objects
for delete
to authenticated
using (bucket_id = 'event-posters');
