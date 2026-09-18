-- UK visa sponsor register (src/app/(public)/visa-sponsors/*,
-- src/components/marketing/sponsor-*) — schema only, no gov.uk ingestion
-- pipeline yet (that's real follow-up work; every sponsor page today
-- renders the intended layout against zero rows, honestly, rather than
-- faking data). Mirrors the Home Office's own published "Register of
-- licensed sponsors" shape: one row per organisation/location, each
-- holding one or more visa routes, refreshed periodically from a
-- published CSV that itself carries an "as of" date distinct from
-- whenever this app happens to run the sync.
--
-- Three tables:
--   sponsor_imports — one row per sync run (when it ran, what the
--     source register's own as-of date was, how many rows it produced,
--     success/failure). The audit trail a future ingestion job writes to
--     and the "last verified"/"data as of" badge these public pages read
--     from — same append-only-log spirit as billing_events, but for a
--     data sync instead of a billing lifecycle.
--   sponsors — current state, one row per (company, town/city), upserted
--     on each sync rather than kept as full history — a full per-company
--     history isn't needed for anything these pages show; sponsor_imports'
--     own aggregate counts are enough trend data at that level.
--   sponsor_routes — many-to-one: a sponsor can hold more than one visa
--     route (the search filter's own route dropdown), so this is a real
--     child table rather than a route list squeezed into one column,
--     exactly the "index it for filtering" case a jsonb array would be a
--     poor fit for.

create type public.sponsor_import_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.sponsor_imports (
  id uuid primary key default gen_random_uuid(),

  -- Where this run's data came from, and — separately — the date the
  -- Home Office itself says the register reflects. The two are never
  -- the same thing: this app might run a sync days after gov.uk actually
  -- published that data, and "Last verified" on a company profile means
  -- the latter, not "whenever we happened to press sync".
  source_url text not null check (char_length(source_url) <= 2000),
  source_date date not null,

  status public.sponsor_import_status not null default 'pending',
  -- Null until the run actually finishes (success or failure) — these
  -- are the real result counts, not a guess made up front.
  sponsor_count integer check (sponsor_count is null or sponsor_count >= 0),
  route_count integer check (route_count is null or route_count >= 0),
  error_message text check (char_length(error_message) <= 2000),

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  check (status not in ('completed', 'failed') or completed_at is not null)
);

alter table public.sponsor_imports enable row level security;

-- Public read, like plans/blog_* — anyone can see when the register was
-- last synced and whether the last attempt succeeded, without an
-- account. No insert/update/delete policy: only a future service-role
-- ingestion job ever writes here, same "trusted server-side logic only"
-- pattern access_codes/blog_* already established.
create policy "Anyone can view sponsor imports"
  on public.sponsor_imports for select
  using (true);

-- At most one *completed* import per source date — re-running a sync for
-- a register snapshot the app has already fully ingested would just be a
-- duplicate. Deliberately not a plain unique(source_date): a failed or
-- still-processing attempt for that same date must stay retryable.
create unique index sponsor_imports_completed_source_date_idx
  on public.sponsor_imports (source_date)
  where (status = 'completed');

-- Supports "find the most recent completed import" — the query every
-- public sponsor page needs before it can show a "data as of" date.
create index sponsor_imports_status_source_date_idx
  on public.sponsor_imports (status, source_date desc);

-- ---------------------------------------------------------------------

create type public.sponsor_rating as enum ('a_rating', 'a_rating_provisional');

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),

  -- The import that most recently confirmed this row still appears on
  -- the register. ON DELETE CASCADE is deliberate, not an oversight:
  -- deleting an import means "that sync never happened", and any
  -- sponsor rows that exist *only* because of it shouldn't survive it
  -- either — a row genuinely still on the register will simply be
  -- reinserted (and re-pointed at a newer import) the next time a real
  -- sync runs.
  import_id uuid not null references public.sponsor_imports (id) on delete cascade,

  -- Both an original (for display — the register's own capitalisation/
  -- punctuation, never rewritten) and a normalized form (lowercased, for
  -- search and as this table's real dedup key) — same split as this
  -- app's own entitlements-vs-display pattern elsewhere: one column for
  -- what a human reads, one for what a query matches against.
  company_name text not null check (char_length(company_name) between 1 and 300),
  company_name_normalized text not null check (char_length(company_name_normalized) between 1 and 300),

  town_city text check (char_length(town_city) <= 200),
  town_city_normalized text check (char_length(town_city_normalized) <= 200),
  county text check (char_length(county) <= 200),

  rating public.sponsor_rating not null,

  -- true until a sync completes without seeing this (company, town/city)
  -- on the register any more — a licence that's lapsed or been revoked
  -- stops showing up in search/city/company pages without erasing the
  -- row and losing which import last actually confirmed it.
  is_active boolean not null default true,

  -- Denormalized from sponsor_imports.source_date onto the row itself —
  -- every public page that shows one sponsor's "last verified" date
  -- needs this without joining back to sponsor_imports just to read one
  -- date off the import that touched it last.
  source_date date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (company_name_normalized = lower(company_name_normalized)),
  check (town_city_normalized is null or town_city_normalized = lower(town_city_normalized)),

  -- The real upsert key a sync writes against: the same organisation
  -- name can legitimately appear more than once on the register at
  -- different locations, so location is part of identity, not just
  -- display.
  unique (company_name_normalized, town_city_normalized)
);

alter table public.sponsors enable row level security;

-- Public read, gated on both is_active (see above) and the owning
-- import having actually finished — a long sync that commits rows
-- incrementally rather than in one all-or-nothing transaction must never
-- let a reader see a half-imported snapshot as if it were complete.
create policy "Anyone can view active sponsors from a completed import"
  on public.sponsors for select
  using (
    is_active
    and exists (
      select 1 from public.sponsor_imports si
      where si.id = sponsors.import_id and si.status = 'completed'
    )
  );

create index sponsors_import_id_idx on public.sponsors (import_id);
create index sponsors_company_name_normalized_idx on public.sponsors (company_name_normalized);
create index sponsors_town_city_normalized_idx on public.sponsors (town_city_normalized);
create index sponsors_county_idx on public.sponsors (county);
create index sponsors_rating_idx on public.sponsors (rating);

-- Partial, matching the shape every public query actually runs — city/
-- search pages only ever want active sponsors, never the full table.
create index sponsors_active_town_city_idx
  on public.sponsors (town_city_normalized)
  where (is_active);

create trigger set_sponsors_updated_at
  before update on public.sponsors
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------

-- Matches src/components/marketing/sponsor-search-filters.tsx's ROUTES
-- list exactly (minus its "All routes" sentinel, which is a UI-only
-- value, never a real route).
create type public.sponsor_visa_route as enum (
  'skilled_worker',
  'health_and_care_worker',
  'global_business_mobility',
  'temporary_worker',
  'international_agreement'
);

create table public.sponsor_routes (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  route public.sponsor_visa_route not null,
  created_at timestamptz not null default now(),
  unique (sponsor_id, route)
);

alter table public.sponsor_routes enable row level security;

-- Same completed-import + active-sponsor gate as sponsors itself,
-- re-checked here rather than assumed inherited — Postgres RLS policies
-- don't compose across tables on their own, so a route row needs its own
-- policy even though it's always reached through a sponsor.
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
