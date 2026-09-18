-- Graduate schemes (src/app/(public)/graduate-visa-sponsorship,
-- src/components/marketing/grad-scheme-results.tsx) — schema only, same
-- stage 0049_sponsors.sql started at: no real data or wiring yet, the
-- page today renders its intended layout against
-- src/config/grad-schemes.ts's five fictional ILLUSTRATIVE_GRAD_SCHEMES
-- entries, honestly labelled as such rather than faking a live table.
--
-- Unlike sponsors, there's no automated public feed to sync this from —
-- gov.uk publishes the sponsor register, not a per-scheme sponsorship
-- verdict. Each row here is a claim this app itself stands behind
-- ("Sponsors visas" / "Does not sponsor" / "Unconfirmed"), so it needs
-- its own sourcing trail (source_url, source_date) and its own
-- freshness signal (verified_at) distinct from when the evidence was
-- published. Content is curated, not user-submitted, so this follows
-- blog_posts' pattern exactly: public read, no insert/update/delete
-- policy — only a service-role process (a future admin tool, or a
-- migration in the meantime) ever writes here.

-- Matches src/config/grad-schemes.ts's GRAD_SCHEME_SECTORS exactly.
create type public.graduate_scheme_sector as enum (
  'consulting',
  'banking_and_finance',
  'law',
  'technology',
  'public_sector'
);

-- Matches src/config/grad-schemes.ts's SPONSORSHIP_STATUSES exactly —
-- snake_case here, same split as sponsor_rating/SPONSOR_RATING_LABELS:
-- the enum is a stable DB value, the human-readable label ("Sponsors
-- visas") lives in the frontend and can change without a migration.
create type public.graduate_scheme_sponsorship_status as enum (
  'sponsors_visas',
  'does_not_sponsor',
  'unconfirmed'
);

create table public.graduate_schemes (
  id uuid primary key default gen_random_uuid(),

  -- The company running the scheme, and the scheme's own name — kept
  -- separate since one employer can run more than one named programme
  -- (e.g. a technology scheme and a separate finance scheme).
  employer text not null check (char_length(employer) between 1 and 300),
  scheme_name text not null check (char_length(scheme_name) between 1 and 300),

  sector public.graduate_scheme_sector not null,

  -- Free text, not a numeric range: published figures vary between a
  -- single number, a band, or "Not disclosed", and forcing that into
  -- min/max columns would mean inventing precision the source doesn't
  -- give.
  salary text check (char_length(salary) <= 200),

  -- Where the scheme actually places graduates — a scheme-level fact,
  -- not a per-office child table like sponsor_routes: there's no filter
  -- or search built against this yet (see grad-scheme-results.tsx), so
  -- a plain array is enough until real location filtering exists.
  locations text[] not null default '{}',

  sponsorship_status public.graduate_scheme_sponsorship_status not null default 'unconfirmed',

  -- Free-text context for *why* a status was set — e.g. what the
  -- evidence actually said, or why it's marked "Unconfirmed" rather
  -- than one of the definite states.
  notes text check (char_length(notes) <= 2000),

  -- The evidence this row's status is based on (see this migration's
  -- own comment above) — required, matching the page's own "Evidence
  -- and sources" methodology claim: every status here is meant to be
  -- checked against something, never guessed.
  source_url text not null check (char_length(source_url) <= 2000),
  -- The date that evidence itself reflects, separate from...
  source_date date not null,
  -- ...the date this app itself last rechecked that the evidence still
  -- holds — same "as of" vs "we last looked" split sponsors makes
  -- between sponsor_imports.source_date and sponsor_sync_status.
  verified_at date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (verified_at >= source_date),

  -- One row per named scheme per employer — an employer running two
  -- distinctly named programmes gets two rows, not one row with two
  -- names crammed together.
  unique (employer, scheme_name)
);

alter table public.graduate_schemes enable row level security;

-- Public read, no account required — same reasoning as sponsors/
-- blog_posts: this is public-facing content, not user data.
create policy "Anyone can view graduate schemes"
  on public.graduate_schemes for select
  using (true);

create index graduate_schemes_sector_idx on public.graduate_schemes (sector);
create index graduate_schemes_sponsorship_status_idx on public.graduate_schemes (sponsorship_status);

create trigger set_graduate_schemes_updated_at
  before update on public.graduate_schemes
  for each row execute procedure public.set_updated_at();
