-- sponsor_stem_candidates (0101) measured 3.3 s for five stems and hit the anon statement timeout: with a per-stem
-- LIKE pattern coming from the outer side of a lateral join the planner can't turn it into an index range, and the
-- ORDER BY steered it to the default-collation index instead of the prefix (text_pattern_ops) one, so every stem that
-- matched nothing scanned the whole register. This states the prefix as an explicit range on the prefix index
-- (>= stem and < stem + the highest code point), which a parameterized index scan can use, and drops the ordering.

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
    where length(st.stem) >= 3
      and x.company_name_normalized ~>=~ st.stem
      and x.company_name_normalized ~<~ (st.stem || chr(1114111))
      and x.is_active
    limit 20
  ) s
  where exists (select 1 from public.sponsor_imports where status = 'completed');
$$;

grant execute on function public.sponsor_stem_candidates(text[]) to anon, authenticated;
