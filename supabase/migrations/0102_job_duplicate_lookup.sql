-- Duplicate detection for a batch of incoming jobs, done in one set-based query instead of in application code.
--
-- The previous lookup fetched every visible job whose company matched any company in the batch through PostgREST: the
-- `in (...)` list overflowed the request URL on a real batch, and a large employer's jobs alone can exceed PostgREST's
-- 1,000-row cap, so duplicates were silently missed. This takes the batch as three parallel arrays and returns, per
-- position, the earliest still-visible job with the same company + title + location (normalized), if any. Service role
-- only — it is part of ingestion, not something a browser calls.

create or replace function public.find_visible_job_duplicates(
  p_company text[],
  p_title text[],
  p_location text[]
)
returns table (pos integer, original_id uuid)
language sql
stable
as $$
  select distinct on (k.pos) k.pos::integer, j.id
  from unnest(p_company, p_title, p_location) with ordinality as k(company, title, location, pos)
  join public.jobs j
    on j.company_name_normalized = k.company
   and j.title_normalized = k.title
   and j.location_normalized is not distinct from k.location
  where j.is_active
    and j.duplicate_of_job_id is null
    and (j.expires_at is null or j.expires_at > now())
  order by k.pos, j.created_at, j.id;
$$;

revoke all on function public.find_visible_job_duplicates(text[], text[], text[]) from public, anon, authenticated;
