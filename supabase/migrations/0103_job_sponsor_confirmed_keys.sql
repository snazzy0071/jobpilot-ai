-- "Licensed sponsors only" over a real-size feed: the per-row job_sponsor_confirmed() call (two register lookups per job)
-- took 1.7-2.2 s for 20,000 jobs. The register only changes when a sync completes, so which employer names are
-- unambiguously on it is precomputed as a materialized view (same approach as the register's statistics views, 0097) and
-- refreshed by the importer's refresh_sponsor_stats(). search_jobs then semi-joins against it: same rule as
-- src/lib/jobs/sponsor-match.ts (a name that resolves, through a sponsor's own name or a legal/trading-name alias, to
-- exactly one company), evaluated as one indexed join instead of per-row lookups.

create materialized view if not exists public.sponsor_confirmed_keys as
select m.key
from (
  select s.company_name_normalized as key, s.company_name_normalized as company
  from public.sponsors s
  where s.is_active
  union all
  select a.alias_name_normalized, s.company_name_normalized
  from public.sponsor_aliases a
  join public.sponsors s on s.id = a.sponsor_id
  where s.is_active
) m
where exists (select 1 from public.sponsor_imports where status = 'completed')
group by m.key
having count(distinct m.company) = 1;

create unique index if not exists sponsor_confirmed_keys_key_idx on public.sponsor_confirmed_keys (key);

-- Public register data only (normalized names), like the other statistics views.
grant select on public.sponsor_confirmed_keys to anon, authenticated;

create or replace function public.refresh_sponsor_stats()
returns void
language plpgsql
as $$
begin
  refresh materialized view public.sponsor_rating_counts;
  refresh materialized view public.sponsor_route_counts;
  refresh materialized view public.sponsor_city_counts;
  refresh materialized view public.sponsor_confirmed_keys;
end;
$$;
revoke all on function public.refresh_sponsor_stats() from public, anon, authenticated;

create or replace function public.search_jobs(
  p_query text default null,
  p_location text default null,
  p_source_id uuid default null,
  p_posted_within_days integer default null,
  p_sponsor_only boolean default false,
  p_cv_version_id uuid default null,
  p_min_score integer default null,
  p_sort text default 'newest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  source_id uuid,
  external_id text,
  title text,
  company_name text,
  location text,
  description text,
  url text,
  posted_at timestamptz,
  expires_at timestamptz,
  is_active boolean,
  match_score smallint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_q text := nullif(regexp_replace(lower(trim(coalesce(p_query, ''))), '\s+', ' ', 'g'), '');
  v_like text;
  v_tsq tsquery;
  v_loc text := nullif(regexp_replace(lower(trim(coalesce(p_location, ''))), '\s+', ' ', 'g'), '');
  v_loc_like text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_since timestamptz := case when coalesce(p_posted_within_days, 0) > 0 then now() - make_interval(days => p_posted_within_days) end;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_tsq := websearch_to_tsquery('english', v_q);
  end if;
  if v_loc is not null then
    v_loc_like := '%' || replace(replace(replace(v_loc, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    j.id, j.source_id, j.external_id, j.title, j.company_name, j.location,
    left(j.description, 600) as description,
    j.url, j.posted_at, j.expires_at, j.is_active,
    jm.match_score,
    count(*) over () as total_count
  from public.jobs j
  left join lateral (
    select m.match_score
    from public.job_matches m
    where p_cv_version_id is not null
      and m.job_id = j.id
      and m.user_id = auth.uid()
      and m.cv_version_id = p_cv_version_id
    order by m.created_at desc
    limit 1
  ) jm on true
  where j.is_active
    and (j.expires_at is null or j.expires_at > now())
    and j.duplicate_of_job_id is null
    and (
      v_q is null
      or j.search_vector @@ v_tsq
      or j.title_normalized like v_like
      or j.company_name_normalized like v_like
    )
    and (v_loc is null or j.location_normalized like v_loc_like)
    and (p_source_id is null or j.source_id = p_source_id)
    and (v_since is null or j.posted_at >= v_since)
    and (p_min_score is null or jm.match_score >= p_min_score)
    and (
      not coalesce(p_sponsor_only, false)
      or exists (select 1 from public.sponsor_confirmed_keys k where k.key = j.company_name_normalized)
    )
  order by
    (case when p_sort = 'relevance' and v_q is not null
       then (case when j.title_normalized like v_like then 2 else 0 end) + ts_rank(j.search_vector, v_tsq) end) desc nulls last,
    (case when p_sort = 'match_desc' then jm.match_score end) desc nulls last,
    (case when p_sort = 'company_az' then j.company_name_normalized end) asc,
    (case when p_sort = 'oldest' then j.posted_at end) asc nulls last,
    j.posted_at desc nulls last,
    j.id
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.search_jobs(text, text, uuid, integer, boolean, uuid, integer, text, integer, integer) to anon, authenticated;
