# Grow Albania Calendar (Portable Package)

This package contains only the calendar app components, isolated from other local projects.

## Included
- `web/` static frontend (`/widget`, `/admin`)
- `data/schema.sql` Supabase schema
- `scripts/import_events.mjs` optional RSS/ICS importer
- `render.yaml` Render Blueprint for static deploy

## Deploy to Render (Static)
1. Push this folder to a dedicated GitHub repo.
2. In Render, create Blueprint from repo.
3. Render will use `render.yaml`.
4. App routes:
   - `/widget/`
   - `/admin/`

## Deploy to GitHub Pages
1. Publish the `web/` folder as site root (or repository root if you flatten structure).
2. Use:
   - `/widget/`
   - `/admin/`

## Supabase setup
1. Run `data/schema.sql` in SQL Editor.
2. Configure `web/shared/config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `EVENT_IMAGE_BUCKET` (default `event-posters`)

## Storage setup for image upload
Run this SQL in Supabase SQL Editor:

```sql
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

create policy "Public can upload posters"
on storage.objects
for insert
to public
with check (bucket_id = 'event-posters');

create policy "Public can read posters"
on storage.objects
for select
to public
using (bucket_id = 'event-posters');

create policy "Authenticated can update posters"
on storage.objects
for update
to authenticated
using (bucket_id = 'event-posters')
with check (bucket_id = 'event-posters');

create policy "Authenticated can delete posters"
on storage.objects
for delete
to authenticated
using (bucket_id = 'event-posters');
```

## Optional importer
1. Copy `scripts/.env.example` to `scripts/.env` and fill values.
2. Run:
```bash
cd scripts
npm install
node import_events.mjs
```

## Squarespace embed
```html
<iframe
  src="https://YOUR-HOST/widget/"
  style="width:100%;height:1500px;border:0;"
  loading="lazy"
  title="Tirana Events Calendar"
></iframe>
```
