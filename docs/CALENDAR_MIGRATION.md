# Calendar Migration (GitHub + Render)

This guide moves only the calendar app parts so you can avoid cross-project conflicts.

## 1) Files to include for the calendar app

Required:
- `web/`
- `data/schema.sql`
- `README.md`
- `render.calendar.yaml`
- `docs/CALENDAR_MIGRATION.md`

Optional (if you use feed import):
- `scripts/import_events.mjs`
- `scripts/package.json`
- `data/sources.example.txt`

## 2) New GitHub repository (recommended)

Use a dedicated repo for the calendar to avoid mixing with the other project.

Suggested structure at repo root:
- `web/`
- `data/`
- `scripts/` (optional)
- `render.calendar.yaml`
- `README.md`

## 3) Render deployment (static)

This project includes `render.calendar.yaml` for the static calendar site.

On Render:
1. Create a new Blueprint instance from your GitHub repo.
2. Choose `render.calendar.yaml`.
3. Deploy.

The resulting URLs:
- `/widget/` for public calendar
- `/admin/` for admin interface

## 4) GitHub Pages deployment (alternative)

If using GitHub Pages:
1. Configure Pages to publish from `/web`.
2. Use:
   - `/widget/`
   - `/admin/`

## 5) Supabase dependencies

Before production use:
1. Run `data/schema.sql` in Supabase SQL Editor.
2. Ensure `web/shared/config.js` points to your Supabase project.
3. For direct image uploads, create bucket + storage policies from the README section.

## 6) Squarespace embed (public calendar)

Use:

```html
<iframe
  src="https://YOUR-HOST/widget/"
  style="width:100%;height:1500px;border:0;"
  loading="lazy"
  title="Tirana Events Calendar"
></iframe>
```

