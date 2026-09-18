-- Corrects two real mistakes in migration 0049, both only discoverable
-- by actually parsing the real gov.uk register (see
-- scripts/import-sponsors.mjs's own doc comment for exactly what was
-- downloaded and checked — 143,149 real rows, not a guess):
--
-- 1. Rating is a property of each individual route *entry*, not of a
--    company as a whole. Real example: Rolls-Royce plc, Derby holds a
--    "Worker (A rating)" Skilled Worker licence and a "Temporary Worker
--    (A rating)" Global Business Mobility: Graduate Trainee licence in
--    the very same register — same company, same location, two entries,
--    and nothing stops the two from actually carrying different ratings
--    (the source data contains real B-rated entries too, at 0.05% of
--    rows). Rating now lives on sponsor_routes (authoritative per
--    entry); sponsors.rating (migration 0049) becomes an import-time-
--    computed *summary* — the best rating across a sponsor's routes —
--    kept and still indexed for the same "fast list/filter without a
--    join" reason it was added for in the first place, not a second
--    source of truth that can silently disagree with the real one.
--
-- 2. `sponsor_visa_route` (migration 0049) assumed 5 route values from
--    this app's own marketing filter dropdown, never from the real
--    register. The real Route column has at least 17 distinct values —
--    five separate Global Business Mobility *sub*-routes alone ("Global
--    Business Mobility" bare never appears), plus Tier 2 Ministers of
--    Religion, Creative Worker, Charity Worker, International
--    Sportsperson, Religious Worker, Government Authorised Exchange,
--    Scale-up, Seasonal Worker, and more — a taxonomy the Home Office
--    controls and can rename or extend between register publications
--    without this app's schema changing. Moved to text, validated at
--    the app/TS layer (src/lib/sponsors/types.ts) instead — the exact
--    choice, and the exact reasoning, migration 0033 already made for
--    ats_keywords.suggested_section.
--
-- `sponsor_rating` itself keeps its enum shape (a bucket *this app*
-- defines, not a gov.uk taxonomy directly) — just extended with the two
-- real buckets 0049 didn't anticipate. sponsor_routes is dropped and
-- recreated rather than altered in place: safe to restructure outright,
-- same as migrations 0031/0038 — no live project has ever been
-- connected this session, so there's no real data to migrate. sponsors
-- itself needs no structural change beyond the two new enum values and
-- one new column, so it isn't rebuilt.

alter type public.sponsor_rating add value 'b_rating';
alter type public.sponsor_rating add value 'other';

-- The verbatim "Type & Rating" cell for the sponsor's best-rated route,
-- alongside the existing bucketed `rating` — same original-plus-
-- normalized split `company_name`/`company_name_normalized` already
-- established in 0049, now applied to rating too. Direct ADD COLUMN ...
-- NOT NULL (no default): safe only because this table has never held a
-- real row in any connected environment, per this migration's own doc
-- comment above.
alter table public.sponsors add column rating_raw text not null check (char_length(rating_raw) <= 200);

drop table public.sponsor_routes;
drop type public.sponsor_visa_route;

create table public.sponsor_routes (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,

  route text not null check (char_length(route) between 1 and 200),

  -- Authoritative per-entry rating — see this migration's own doc
  -- comment for why this isn't just inherited from sponsors.rating.
  rating public.sponsor_rating not null,
  rating_raw text not null check (char_length(rating_raw) <= 200),

  created_at timestamptz not null default now(),

  -- Not (sponsor_id, route) alone: the same route can legitimately carry
  -- more than one rating across genuinely separate licence entries in
  -- the source data, and the source also contains literal exact-
  -- duplicate rows (same org, same location, same type & rating, same
  -- route, more than once) — this constraint correctly collapses those
  -- into one row via upsert while still keeping a real (route, rating)
  -- split as two rows.
  unique (sponsor_id, route, rating)
);

alter table public.sponsor_routes enable row level security;

-- Same completed-import + active-sponsor gate 0049 established — Postgres
-- RLS policies don't compose across tables on their own, so this needs
-- restating even though nothing else about the policy's intent changed.
create policy "Anyone can view routes for a visible sponsor"
  on public.sponsor_routes for select
  using (
    exists (
      select 1 from public.sponsors s
      join public.sponsor_imports si on si.id = s.import_id
      where s.id = sponsor_routes.sponsor_id and s.is_active and si.status = 'completed'
    )
  );

create index sponsor_routes_sponsor_id_idx on public.sponsor_routes (sponsor_id);
create index sponsor_routes_route_idx on public.sponsor_routes (route);
create index sponsor_routes_rating_idx on public.sponsor_routes (rating);
