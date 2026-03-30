create table if not exists public.admin_access_requests (
  id bigint generated always as identity primary key,
  name text,
  email text not null,
  requested_role text not null default 'moderator' check (requested_role in ('moderator', 'editor', 'owner')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'reviewed')),
  resolved_role text check (resolved_role in ('moderator', 'editor', 'owner')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_admin_access_requests_updated_at on public.admin_access_requests;
create trigger set_admin_access_requests_updated_at
before update on public.admin_access_requests
for each row execute procedure public.set_updated_at();

alter table public.admin_access_requests enable row level security;

notify pgrst, 'reload schema';
