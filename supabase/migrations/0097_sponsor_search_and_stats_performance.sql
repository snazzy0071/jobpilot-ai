-- Performance/correctness follow-up to 0095, found by running the real search against the real 127k-sponsor
-- register as the anonymous role (which has a 3-second statement timeout):
--
--   * search_sponsors took 1.2-1.7s for a query with *no* matches and timed out (3s+) for alias searches, filtered
--     searches and common words. The single big statement made the planner scan every sponsor to join the matches
--     back; it is now a plpgsql function that starts from the matches, only adds the (expensive) fuzzy trigram match
--     when the cheap exact/prefix/substring matches don't already fill a page, and treats 1-2 character terms as
--     prefix-only (a trigram index can't help below 3 characters, and "ab" matches most of the register anyway).
--   * The three statistics views re-aggregated 142k route rows on every page view (~2s for the route counts alone).
--     They are now materialized views refreshed by the importer right after it marks a sync completed — the numbers
--     only change when the register does.
--   * sponsor_city_counts returned every town (more than PostgREST's 1,000-row cap), and the app looked up its eight
--     cities in that truncated, unordered list — a real city could silently show 0. The app now asks for the towns it
--     wants by name (see src/lib/sponsors/queries.ts).

create index if not exists sponsors_company_name_search_prefix_idx
  on public.sponsors (company_name_search text_pattern_ops);

drop function if exists public.search_sponsors(text, text, text, public.sponsor_rating, integer, integer);

create function public.search_sponsors(
  p_query text default null,
  p_city text default null,
  p_route text default null,
  p_rating public.sponsor_rating default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  company_name text,
  town_city text,
  county text,
  rating public.sponsor_rating,
  source_date date,
  matched_alias text,
  total_count bigint
)
language plpgsql
stable
as $$
declare
  v_term text := public.sponsor_search_normalize(p_query);
  v_city text := nullif(regexp_replace(lower(trim(coalesce(p_city, ''))), '\s+', ' ', 'g'), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_fuzzy boolean := false;
  v_cheap integer;
begin
  -- No company term: pure filtering, ordered by name.
  if v_term is null then
    return query
    select s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, null::text, count(*) over ()
    from public.sponsors s
    where (v_city is null or s.town_city_normalized = v_city)
      and (p_rating is null or s.rating = p_rating)
      and (p_route is null or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route))
    order by s.company_name, s.id
    limit v_limit offset v_offset;
    return;
  end if;

  -- 1-2 character terms: prefix only (btree), on the sponsor's name.
  if length(v_term) < 3 then
    return query
    select s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, null::text, count(*) over ()
    from public.sponsors s
    where s.company_name_search like v_term || '%'
      and (v_city is null or s.town_city_normalized = v_city)
      and (p_rating is null or s.rating = p_rating)
      and (p_route is null or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route))
    order by s.company_name, s.id
    limit v_limit offset v_offset;
    return;
  end if;

  -- Is the cheap match (substring on the name or an alias) enough to fill the page being asked for? If so, skip the
  -- fuzzy pass entirely — it only exists to rescue typos and reorderings, and is the costly part.
  select count(*) into v_cheap from (
    select 1
    from public.sponsors s
    where s.company_name_search like '%' || v_term || '%'
      and (v_city is null or s.town_city_normalized = v_city)
      and (p_rating is null or s.rating = p_rating)
      and (p_route is null or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route))
    limit 25
  ) c;
  v_fuzzy := v_cheap < 25;

  if v_fuzzy then
    -- The <% operator's cut-off is a pg_trgm setting (default 0.6, too strict for two typos in a name). A function-
    -- level SET can't be used: naming a pg_trgm variable before the library is loaded in the session is refused.
    -- Touching a pg_trgm function first loads it, after which the setting can be changed for this statement only.
    perform extensions.word_similarity('a', 'a');
    perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);
    return query
    with direct as (
      select s.id,
        case
          when s.company_name_search = v_term then 1.0
          when s.company_name_search like v_term || '%' then 0.9
          when s.company_name_search like '%' || v_term || '%' then 0.8
          else extensions.word_similarity(v_term, s.company_name_search) * 0.7
        end as score,
        null::text as matched_alias
      from public.sponsors s
      where s.company_name_search like '%' || v_term || '%'
         or v_term operator(extensions.<%) s.company_name_search
    ),
    via_alias as (
      select sa.sponsor_id as id,
        0.95 * case
          when sa.alias_name_search = v_term then 1.0
          when sa.alias_name_search like v_term || '%' then 0.9
          when sa.alias_name_search like '%' || v_term || '%' then 0.8
          else extensions.word_similarity(v_term, sa.alias_name_search) * 0.7
        end as score,
        sa.alias_name as matched_alias
      from public.sponsor_aliases sa
      where sa.alias_name_search like '%' || v_term || '%'
         or v_term operator(extensions.<%) sa.alias_name_search
    ),
    best as (
      select distinct on (m.id) m.id, m.score, m.matched_alias
      from (select * from direct union all select * from via_alias) m
      order by m.id, m.score desc
    )
    select s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, b.matched_alias, count(*) over ()
    from best b
    join public.sponsors s on s.id = b.id
    where (v_city is null or s.town_city_normalized = v_city)
      and (p_rating is null or s.rating = p_rating)
      and (p_route is null or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route))
    order by b.score desc, s.company_name, s.id
    limit v_limit offset v_offset;
  else
    return query
    with direct as (
      select s.id,
        case
          when s.company_name_search = v_term then 1.0
          when s.company_name_search like v_term || '%' then 0.9
          else 0.8
        end as score,
        null::text as matched_alias
      from public.sponsors s
      where s.company_name_search like '%' || v_term || '%'
    ),
    via_alias as (
      select sa.sponsor_id as id,
        0.95 * case
          when sa.alias_name_search = v_term then 1.0
          when sa.alias_name_search like v_term || '%' then 0.9
          else 0.8
        end as score,
        sa.alias_name as matched_alias
      from public.sponsor_aliases sa
      where sa.alias_name_search like '%' || v_term || '%'
    ),
    best as (
      select distinct on (m.id) m.id, m.score, m.matched_alias
      from (select * from direct union all select * from via_alias) m
      order by m.id, m.score desc
    )
    select s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, b.matched_alias, count(*) over ()
    from best b
    join public.sponsors s on s.id = b.id
    where (v_city is null or s.town_city_normalized = v_city)
      and (p_rating is null or s.rating = p_rating)
      and (p_route is null or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route))
    order by b.score desc, s.company_name, s.id
    limit v_limit offset v_offset;
  end if;
end;
$$;

grant execute on function public.search_sponsors(text, text, text, public.sponsor_rating, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- statistics: materialized, refreshed by the importer
-- ---------------------------------------------------------------------

drop view public.sponsor_rating_counts;
drop view public.sponsor_route_counts;
drop view public.sponsor_city_counts;

create materialized view public.sponsor_rating_counts as
select s.rating, count(*)::integer as sponsor_count
from public.sponsors s
where s.is_active and exists (select 1 from public.sponsor_imports where status = 'completed')
group by s.rating;
create unique index sponsor_rating_counts_rating_idx on public.sponsor_rating_counts (rating);

create materialized view public.sponsor_route_counts as
select sr.route, count(distinct sr.sponsor_id)::integer as sponsor_count
from public.sponsor_routes sr
join public.sponsors s on s.id = sr.sponsor_id
where s.is_active and exists (select 1 from public.sponsor_imports where status = 'completed')
group by sr.route;
create unique index sponsor_route_counts_route_idx on public.sponsor_route_counts (route);
create index sponsor_route_counts_count_idx on public.sponsor_route_counts (sponsor_count desc);

create materialized view public.sponsor_city_counts as
select s.town_city_normalized, count(*)::integer as sponsor_count
from public.sponsors s
where s.is_active and s.town_city_normalized is not null
  and exists (select 1 from public.sponsor_imports where status = 'completed')
group by s.town_city_normalized;
create unique index sponsor_city_counts_city_idx on public.sponsor_city_counts (town_city_normalized);

-- Materialized views aren't subject to row-level security; these hold only public aggregate counts.
grant select on public.sponsor_rating_counts, public.sponsor_route_counts, public.sponsor_city_counts to anon, authenticated;

-- Called by scripts/import-sponsors.mjs after it records a sync as completed. Service role only.
create function public.refresh_sponsor_stats()
returns void
language plpgsql
as $$
begin
  refresh materialized view public.sponsor_rating_counts;
  refresh materialized view public.sponsor_route_counts;
  refresh materialized view public.sponsor_city_counts;
end;
$$;
revoke all on function public.refresh_sponsor_stats() from public, anon, authenticated;
