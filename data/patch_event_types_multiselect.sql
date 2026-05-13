alter table public.events
add column if not exists event_types text[] not null default '{}'::text[];

update public.events
set event_types = (
  select array_agg(distinct normalized_value order by
    case normalized_value
      when 'Education' then 1
      when 'Health & Wellness' then 2
      else 3
    end,
    normalized_value
  )
  from (
    select case
      when trim(raw_value) = 'Wellness' then 'Health & Wellness'
      else trim(raw_value)
    end as normalized_value
    from unnest(
      case
        when coalesce(array_length(event_types, 1), 0) > 0 then
          array_cat(
            event_types,
            case
              when trim(coalesce(event_type, '')) in ('Education', 'Wellness', 'Health & Wellness')
                then array['Education', 'Health & Wellness']
              when trim(coalesce(event_type, '')) <> ''
                then array[event_type]
              else array[]::text[]
            end
          )
        when trim(coalesce(event_type, '')) in ('Education', 'Wellness', 'Health & Wellness')
          then array['Education', 'Health & Wellness']
        when trim(coalesce(event_type, '')) <> ''
          then array[event_type]
        else array['Community']
      end
    ) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) normalized
);

update public.events
set event_type = coalesce(nullif(event_types[1], ''), 'Community')
where true;

notify pgrst, 'reload schema';
