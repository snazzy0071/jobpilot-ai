-- Job Search / Match: the parts of the feed that couldn't be done honestly in application code.
--
--   * Search was two ILIKE queries on title/company capped at 300 rows each and merged in memory: it never looked at
--     the description, ignored word order/stemming ("managers" vs "manager"), silently dropped matches past the cap, and
--     could not be combined with the match-score filter. It is now one ranked SQL function (full-text on
--     title/company/description, plus substring on title/company so partial words like "dev" still work).
--   * "Licensed sponsors only" was a post-filter over the first 200 candidate rows, so on a real feed it hid nearly
--     every sponsor job. It is now evaluated in SQL against the whole candidate set, with exactly the rule the
--     per-card badge uses: a confirmed sponsor is an unambiguous exact match on the register (name or trading-name
--     alias). See src/lib/jobs/sponsor-match.ts.
--   * Both run as the function owner and apply the public jobs / sponsors policies' own visibility rules explicitly.
--     Under row-level security the planner cannot use trigram / full-text indexes for non-leakproof operators (the
--     same seq-scan trap found in the sponsor search, 0100), so as invoker these degrade to a full scan per query.
--   * A job's duplicates were hidden forever, even after the listing they duplicated expired — promoted again below.
--   * Add to Tracker: one application per (user, job), enforced by the database rather than a check-then-insert.
--   * job_imports records how many listings a run had to skip (malformed rows), so a "completed" run that dropped rows
--     is visible instead of silently green.

-- ---------------------------------------------------------------------
-- search index
-- ---------------------------------------------------------------------

alter table public.jobs
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists jobs_search_vector_idx on public.jobs using gin (search_vector);
create index if not exists jobs_title_normalized_trgm_idx on public.jobs using gin (title_normalized extensions.gin_trgm_ops);
create index if not exists jobs_company_name_normalized_trgm_idx on public.jobs using gin (company_name_normalized extensions.gin_trgm_ops);
create index if not exists jobs_location_normalized_trgm_idx on public.jobs using gin (location_normalized extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- sponsor cross-check helpers
-- ---------------------------------------------------------------------

-- Prefix lookups by the register's normalized name (the "same company without its Ltd/Plc suffix" tier).
create index if not exists sponsors_company_name_normalized_prefix_idx
  on public.sponsors (company_name_normalized text_pattern_ops);

-- True only for an unambiguous exact match: the job's normalized employer name resolves, through a sponsor's own name
-- or a legal/trading-name alias, to exactly one company on the register. Nothing until a sync has completed.
create or replace function public.job_sponsor_confirmed(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sponsor_imports where status = 'completed')
    and (
      select count(distinct c.k) = 1
      from (
        select s.company_name_normalized as k
        from public.sponsors s
        where s.is_active and s.company_name_normalized = p_key
        union
        select s.company_name_normalized
        from public.sponsor_aliases a
        join public.sponsors s on s.id = a.sponsor_id
        where s.is_active and a.alias_name_normalized = p_key
      ) c
    );
$$;

-- Register rows whose normalized name starts with each stem — the candidates for the "likely, not confirmed" tier.
create or replace function public.sponsor_stem_candidates(p_stems text[])
returns table (
  stem text,
  id uuid,
  company_name text,
  town_city text,
  rating public.sponsor_rating,
  company_name_normalized text
)
language sql
stable
security definer
set search_path = public
as $$
  select st.stem, s.id, s.company_name, s.town_city, s.rating, s.company_name_normalized
  from unnest(p_stems) as st(stem)
  cross join lateral (
    select x.id, x.company_name, x.town_city, x.rating, x.company_name_normalized
    from public.sponsors x
    where x.is_active
      and length(st.stem) >= 3
      and x.company_name_normalized like replace(replace(replace(st.stem, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by x.company_name_normalized
    limit 20
  ) s
  where exists (select 1 from public.sponsor_imports where status = 'completed');
$$;

grant execute on function public.job_sponsor_confirmed(text) to anon, authenticated;
grant execute on function public.sponsor_stem_candidates(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- search_jobs
-- ---------------------------------------------------------------------

-- Ranked, filtered, paged job search. Returns the same visible rows the "Anyone can view active, unexpired,
-- non-duplicate jobs" policy allows, with `description` shortened to an excerpt (the full text is fetched for one job at
-- a time when it's scored). The caller's own match scores for p_cv_version_id come from job_matches through auth.uid(),
-- so min-score filtering and best-match ordering work together with keywords, location and sponsor-only.
--   p_sort: relevance (needs a query) | newest | oldest | company_az | match_desc (needs a CV version)
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
    and (not coalesce(p_sponsor_only, false) or public.job_sponsor_confirmed(j.company_name_normalized))
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

-- ---------------------------------------------------------------------
-- expiry: a duplicate whose original expired becomes the listing
-- ---------------------------------------------------------------------

-- Duplicates stay hidden only while the listing they duplicate is live. Once that one is inactive or past its expiry,
-- the earliest-seen duplicate is promoted to the visible listing and the rest are re-pointed at it. Run by the
-- maintenance sweep after it deactivates expired jobs. Service role only.
create or replace function public.promote_orphaned_job_duplicates()
returns integer
language plpgsql
as $$
declare
  v_promoted integer;
begin
  with orphaned as (
    select d.id, d.duplicate_of_job_id as old_original, d.created_at
    from public.jobs d
    join public.jobs c on c.id = d.duplicate_of_job_id
    where d.is_active
      and (d.expires_at is null or d.expires_at > now())
      and (not c.is_active or (c.expires_at is not null and c.expires_at <= now()))
  ),
  heirs as (
    select distinct on (old_original) old_original, id as heir
    from orphaned
    order by old_original, created_at, id
  ),
  promoted as (
    update public.jobs j set duplicate_of_job_id = null
    from heirs h
    where j.id = h.heir
    returning j.id
  ),
  repointed as (
    update public.jobs j set duplicate_of_job_id = h.heir
    from orphaned o
    join heirs h on h.old_original = o.old_original
    where j.id = o.id and o.id <> h.heir
    returning j.id
  )
  select (select count(*) from promoted)::integer into v_promoted;
  return coalesce(v_promoted, 0);
end;
$$;

revoke all on function public.promote_orphaned_job_duplicates() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- tracker link + import accounting
-- ---------------------------------------------------------------------

-- One tracked application per (user, job). Manually created applications (job_id null) are unaffected.
create unique index if not exists applications_user_job_key
  on public.applications (user_id, job_id)
  where job_id is not null;

alter table public.job_imports
  add column if not exists skipped_count integer check (skipped_count is null or skipped_count >= 0);
