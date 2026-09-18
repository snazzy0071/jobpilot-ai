-- Real, aggregate views backing the sponsor statistics page and the
-- city list/detail pages' real counts — every one deliberately grouped
-- by a column that actually exists (rating, route, town_city), never a
-- "region"/"nation"/"sector" breakdown the schema has no data for (the
-- exact same reasoning the LinkedIn Optimiser and search-filter tasks
-- already applied to their own marketing copy this session).
--
-- Each view's WHERE clause repeats the same `is_active and status =
-- 'completed'` visibility condition sponsors/sponsor_routes/
-- sponsor_aliases' own RLS select policies already use (migrations
-- 0049/0050/0053) — written explicitly here rather than left to a
-- view's default execution context, since whether a plain view
-- transparently inherits the querying role's RLS (security_invoker) or
-- runs as its own owner (security_definer, bypassing RLS entirely) can
-- vary by Postgres version. An aggregate count is the one thing here
-- that isn't sensitive either way, but it must never quietly include a
-- deactivated sponsor just because a view happened to run as its
-- (RLS-bypassing) owner — so the condition is real, not assumed
-- inherited, same discipline sponsor_routes/sponsor_aliases' own select
-- policies already apply for the identical reason.
--
-- No RLS is enabled on any of these views themselves: every row they
-- can ever produce is already public (a count, not an individual
-- sponsor record), matching sponsor_sync_status' own precedent
-- (migration 0054).

create view public.sponsor_rating_counts as
select
  s.rating,
  count(*) as sponsor_count
from public.sponsors s
join public.sponsor_imports si on si.id = s.import_id
where s.is_active and si.status = 'completed'
group by s.rating;

create view public.sponsor_route_counts as
select
  sr.route,
  count(distinct sr.sponsor_id) as sponsor_count
from public.sponsor_routes sr
join public.sponsors s on s.id = sr.sponsor_id
join public.sponsor_imports si on si.id = s.import_id
where s.is_active and si.status = 'completed'
group by sr.route
order by sponsor_count desc;

-- Keyed by the same normalized column sponsors.town_city_normalized
-- already indexes and searchSponsors already matches city filters
-- against (src/lib/sponsors/queries.ts) — so the fixed
-- src/config/sponsor-cities.ts list can be joined against this by
-- normalizing each configured city name the same way, with no new
-- lookup table needed.
create view public.sponsor_city_counts as
select
  s.town_city_normalized,
  count(*) as sponsor_count
from public.sponsors s
join public.sponsor_imports si on si.id = s.import_id
where s.is_active and si.status = 'completed' and s.town_city_normalized is not null
group by s.town_city_normalized;
