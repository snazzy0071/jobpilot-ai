-- Sponsor search that actually copes with the real register.
--
-- The previous search was `company_name_normalized ILIKE '%term%'` (lowercase + collapsed whitespace only), capped
-- at 500 arbitrary rows *before* the city / route / rating filters ran in memory. Against the real 127k-sponsor
-- register that meant: "Rolls Royce" never found "Rolls-Royce plc" (punctuation), any typo found nothing, results
-- weren't ranked, and a filter applied after the cut-off silently dropped genuine matches.
--
-- company_name / company_name_normalized are unchanged (the register's own spelling for display, and the dedup key
-- the importer upserts against). What's added is a separate *search* form — lowercase, "&" -> "and", every run of
-- punctuation/whitespace collapsed to one space — plus trigram indexes and one RPC that does matching, ranking,
-- filtering and paging in the database.

create extension if not exists pg_trgm with schema extensions;

create function public.sponsor_search_normalize(value text)
returns text
language sql
immutable
as $$
  select nullif(trim(regexp_replace(replace(lower(coalesce(value, '')), '&', ' and '), '[^[:alnum:]]+', ' ', 'g')), '');
$$;

alter table public.sponsors
  add column company_name_search text generated always as (public.sponsor_search_normalize(company_name)) stored;
alter table public.sponsor_aliases
  add column alias_name_search text generated always as (public.sponsor_search_normalize(alias_name)) stored;

create index sponsors_company_name_search_trgm_idx
  on public.sponsors using gin (company_name_search extensions.gin_trgm_ops);
create index sponsor_aliases_alias_name_search_trgm_idx
  on public.sponsor_aliases using gin (alias_name_search extensions.gin_trgm_ops);

-- Ranked company search with city / route / rating filters and paging, all in SQL. Runs as the caller (security
-- invoker), so the same row-level security as every other read applies — active sponsors only.
--   * exact search-form match ........ 1.00
--   * starts with the term ........... 0.90
--   * contains the term .............. 0.80
--   * fuzzy (typos, missing/extra words, different word order) — trigram word similarity, scaled to 0.70
-- A match through a trading/legal-name alias ranks just below the same match on the sponsor's own name and reports
-- which alias matched. With no term at all it just filters and orders by name.
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
language sql
stable
set pg_trgm.word_similarity_threshold = '0.5'
as $$
  with params as (
    select
      public.sponsor_search_normalize(p_query) as term,
      nullif(regexp_replace(lower(trim(coalesce(p_city, ''))), '\s+', ' ', 'g'), '') as city
  ),
  direct as (
    select
      s.id,
      case
        when s.company_name_search = pr.term then 1.0
        when s.company_name_search like pr.term || '%' then 0.9
        when s.company_name_search like '%' || pr.term || '%' then 0.8
        else extensions.word_similarity(pr.term, s.company_name_search) * 0.7
      end as score,
      null::text as matched_alias
    from public.sponsors s, params pr
    where pr.term is not null
      and (
        s.company_name_search like '%' || pr.term || '%'
        or (length(pr.term) >= 3 and pr.term operator(extensions.<%) s.company_name_search)
      )
  ),
  via_alias as (
    select
      sa.sponsor_id as id,
      0.95 * case
        when sa.alias_name_search = pr.term then 1.0
        when sa.alias_name_search like pr.term || '%' then 0.9
        when sa.alias_name_search like '%' || pr.term || '%' then 0.8
        else extensions.word_similarity(pr.term, sa.alias_name_search) * 0.7
      end as score,
      sa.alias_name as matched_alias
    from public.sponsor_aliases sa, params pr
    where pr.term is not null
      and (
        sa.alias_name_search like '%' || pr.term || '%'
        or (length(pr.term) >= 3 and pr.term operator(extensions.<%) sa.alias_name_search)
      )
  ),
  best as (
    select distinct on (m.id) m.id, m.score, m.matched_alias
    from (select * from direct union all select * from via_alias) m
    order by m.id, m.score desc
  ),
  candidates as (
    select s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, b.matched_alias, coalesce(b.score, 0) as score
    from public.sponsors s
    join params pr on true
    left join best b on b.id = s.id
    where (pr.term is null or b.id is not null)
      and (pr.city is null or s.town_city_normalized = pr.city)
      and (p_rating is null or s.rating = p_rating)
      and (
        p_route is null
        or exists (select 1 from public.sponsor_routes r where r.sponsor_id = s.id and r.route = p_route)
      )
  )
  select
    c.id, c.company_name, c.town_city, c.county, c.rating, c.source_date, c.matched_alias,
    count(*) over () as total_count
  from candidates c
  order by c.score desc, c.company_name, c.id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_sponsors(text, text, text, public.sponsor_rating, integer, integer) to anon, authenticated;
grant execute on function public.sponsor_search_normalize(text) to anon, authenticated;

-- One sponsor's public profile — including one that has since dropped off the register. Search, city pages and
-- statistics only ever show active sponsors, but a link to a company that was removed should say "no longer on
-- the register (as of <date>)", not 404 as though it had never existed. Security definer because the table's
-- policy (deliberately) hides inactive rows; it returns nothing until a sync has completed.
create function public.get_sponsor_detail(p_id uuid)
returns table (
  id uuid,
  company_name text,
  town_city text,
  county text,
  rating public.sponsor_rating,
  source_date date,
  is_active boolean,
  removed_on date,
  routes text[],
  aliases jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id, s.company_name, s.town_city, s.county, s.rating, s.source_date, s.is_active,
    case when s.is_active then null else (
      select i.source_date
      from public.sponsor_sync_changes c
      join public.sponsor_imports i on i.id = c.import_id
      where c.sponsor_id = s.id and c.change_type = 'deactivated'
      order by c.created_at desc
      limit 1
    ) end as removed_on,
    coalesce((select array_agg(r.route order by r.route) from public.sponsor_routes r where r.sponsor_id = s.id), '{}') as routes,
    coalesce((select jsonb_agg(jsonb_build_object('aliasType', a.alias_type, 'aliasName', a.alias_name)) from public.sponsor_aliases a where a.sponsor_id = s.id), '[]'::jsonb) as aliases
  from public.sponsors s
  where s.id = p_id
    and exists (select 1 from public.sponsor_imports where status = 'completed');
$$;

grant execute on function public.get_sponsor_detail(uuid) to anon, authenticated;
