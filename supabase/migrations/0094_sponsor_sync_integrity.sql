-- Sponsor register sync: three real defects found by running the importer against the live Home Office register
-- (143,130 rows) for the first time and re-importing a changed copy.
--
-- 1. The public register vanished while a sync ran. Visibility was gated on the sponsor's *own* import having
--    status = 'completed', and the importer re-points every sponsor it touches at the new (still 'processing')
--    import — so each sponsor disappeared from public search/city/company pages the moment it was upserted and
--    only came back when the whole run finished. Measured live: anonymous visitors saw 127,687 sponsors, then 2,
--    then a slow climb back over several minutes, on every daily run — and a run that failed part-way would have
--    left everything it had touched hidden until the next success. The gate's intent (never show a half-imported
--    snapshot) is already met by the importer only deactivating sponsors *after* every upsert has finished, so
--    visibility is now `is_active` — plus "some sync has completed", so a never-synced project still shows nothing.
--
-- 2. Sponsors with no town were duplicated on every sync. The upsert key is unique (company, town), and Postgres
--    treats NULLs as distinct, so a register row with an empty town never conflicted with itself: each daily run
--    inserted a fresh copy and then deactivated the old one, logging a phantom "deactivated". The key is now
--    NULLS NOT DISTINCT, and the duplicates already created are merged.
--
-- 3. Routes/aliases a sponsor dropped were never removed. The importer only upserted, so a company that lost (say)
--    its Global Business Mobility licence kept showing that route forever. Every route/alias row now records the
--    import that last saw it, and prune_stale_sponsor_children() removes the ones a sync no longer saw for the
--    sponsors it did see. (Deactivated sponsors keep everything — they aren't in the sync.)

-- ---------------------------------------------------------------------
-- 2. duplicate NULL-town sponsors: merge, then make the key NULL-safe
-- ---------------------------------------------------------------------

create temporary table sponsor_duplicate_map on commit drop as
select id, keeper
from (
  select
    id,
    first_value(id) over w as keeper,
    row_number() over w as rn
  from public.sponsors
  window w as (
    partition by company_name_normalized, town_city_normalized
    order by is_active desc, updated_at desc, id
  )
) ranked
where rn > 1;

-- The change log references sponsors without ON DELETE CASCADE — point it at the survivor first.
update public.sponsor_sync_changes c
set sponsor_id = m.keeper
from sponsor_duplicate_map m
where c.sponsor_id = m.id;

delete from public.sponsors where id in (select id from sponsor_duplicate_map);

alter table public.sponsors drop constraint sponsors_company_name_normalized_town_city_normalized_key;
create unique index sponsors_company_town_key
  on public.sponsors (company_name_normalized, town_city_normalized) nulls not distinct;

-- ---------------------------------------------------------------------
-- 1. visibility: active + "a sync has completed at some point"
-- ---------------------------------------------------------------------

drop policy "Anyone can view active sponsors from a completed import" on public.sponsors;
create policy "Anyone can view active sponsors once a sync has completed"
  on public.sponsors for select
  using (
    is_active
    and exists (select 1 from public.sponsor_imports where status = 'completed')
  );

drop policy "Anyone can view routes for a visible sponsor" on public.sponsor_routes;
create policy "Anyone can view routes for a visible sponsor"
  on public.sponsor_routes for select
  using (
    exists (select 1 from public.sponsors s where s.id = sponsor_routes.sponsor_id and s.is_active)
    and exists (select 1 from public.sponsor_imports where status = 'completed')
  );

drop policy "Anyone can view aliases for a visible sponsor" on public.sponsor_aliases;
create policy "Anyone can view aliases for a visible sponsor"
  on public.sponsor_aliases for select
  using (
    exists (select 1 from public.sponsors s where s.id = sponsor_aliases.sponsor_id and s.is_active)
    and exists (select 1 from public.sponsor_imports where status = 'completed')
  );

-- The statistics views carry their own copy of the visibility rule (they run as their owner, not the caller).
create or replace view public.sponsor_rating_counts as
select s.rating, count(*) as sponsor_count
from public.sponsors s
where s.is_active and exists (select 1 from public.sponsor_imports where status = 'completed')
group by s.rating;

create or replace view public.sponsor_route_counts as
select sr.route, count(distinct sr.sponsor_id) as sponsor_count
from public.sponsor_routes sr
join public.sponsors s on s.id = sr.sponsor_id
where s.is_active and exists (select 1 from public.sponsor_imports where status = 'completed')
group by sr.route
order by sponsor_count desc;

create or replace view public.sponsor_city_counts as
select s.town_city_normalized, count(*) as sponsor_count
from public.sponsors s
where s.is_active and s.town_city_normalized is not null
  and exists (select 1 from public.sponsor_imports where status = 'completed')
group by s.town_city_normalized;

-- ---------------------------------------------------------------------
-- 3. stale routes / aliases
-- ---------------------------------------------------------------------

alter table public.sponsor_routes
  add column last_seen_import_id uuid references public.sponsor_imports (id) on delete set null;
alter table public.sponsor_aliases
  add column last_seen_import_id uuid references public.sponsor_imports (id) on delete set null;

-- Removes routes/aliases the given import did not see, for the sponsors it did see. Called by the importer after
-- every upsert has finished. Returns how many of each it removed (recorded in the import log).
create function public.prune_stale_sponsor_children(p_import_id uuid)
returns table (routes_removed bigint, aliases_removed bigint)
language sql
as $$
  with r as (
    delete from public.sponsor_routes sr
    using public.sponsors s
    where sr.sponsor_id = s.id
      and s.import_id = p_import_id
      and sr.last_seen_import_id is distinct from p_import_id
    returning 1
  ),
  a as (
    delete from public.sponsor_aliases sa
    using public.sponsors s
    where sa.sponsor_id = s.id
      and s.import_id = p_import_id
      and sa.last_seen_import_id is distinct from p_import_id
    returning 1
  )
  select (select count(*) from r), (select count(*) from a);
$$;

revoke all on function public.prune_stale_sponsor_children(uuid) from public, anon, authenticated;

alter table public.sponsor_imports
  add column routes_removed_count integer check (routes_removed_count is null or routes_removed_count >= 0),
  add column aliases_removed_count integer check (aliases_removed_count is null or aliases_removed_count >= 0);
