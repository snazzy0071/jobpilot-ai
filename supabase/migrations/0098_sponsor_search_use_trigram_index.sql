-- Follow-up to 0097: the fuzzy branch of search_sponsors still took 1.1-1.9s on the real register (even for a
-- term with no matches at all) because the planner chose a sequential scan for the trigram match. Same function, with
-- the GIN index steered on for that statement.

drop function public.search_sponsors(text, text, text, public.sponsor_rating, integer, integer);

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
    -- The planner can't know the cut-off chosen just above, prices the trigram scan as unselective and picks a
    -- sequential scan (~1s on the real register). Steer it to the GIN index for this statement only.
    perform set_config('enable_seqscan', 'off', true);
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
