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
