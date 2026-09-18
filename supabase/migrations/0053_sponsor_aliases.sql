-- Legal-vs-trading-name aliases for sponsors — real gov.uk register rows
-- routinely print both in one cell (" PINAL DAYA, T/A LONDIS", "HAH
-- Hospitality Limited t/a Indian Affair Ancoats", "Ian Tappin t/a Lovat
-- House Residential Care Home" — all real rows checked while building
-- scripts/import-sponsors.mjs), and someone searching this register
-- legitimately might type either half. `sponsors.company_name`/
-- `company_name_normalized` (migration 0049) stay exactly what they've
-- always been — the verbatim register cell and its lowercased/trimmed
-- form, untouched, unsplit, un-corrupted — because that's the real
-- source record. This is purely additive: an "also known as" side
-- table the importer populates *from* that same cell without ever
-- rewriting it, so a "Londis"-style trading-name search has something
-- real to match against alongside the legal name search
-- company_name_normalized already supports.
--
-- Same original-plus-normalized split every name column in this schema
-- already uses (company_name/company_name_normalized,
-- town_city/town_city_normalized) — applied a third time, not a new
-- pattern. `alias_type` is plain text, not a DB enum — the same choice,
-- for the same reason, migration 0050 made for sponsor_routes.route:
-- this is a small, app-defined categorisation ('trading_as' today;
-- 'legal_name' when the importer also stores the pre-split legal name
-- as its own alias), not a Home Office taxonomy, but still not
-- something worth an ALTER TYPE every time a new alias kind is added.

create table public.sponsor_aliases (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,

  alias_type text not null check (char_length(alias_type) <= 40),
  alias_name text not null check (char_length(alias_name) between 1 and 300),
  alias_name_normalized text not null check (
    char_length(alias_name_normalized) between 1 and 300
    and alias_name_normalized = lower(alias_name_normalized)
  ),

  created_at timestamptz not null default now(),

  -- Not a bare (sponsor_id, alias_type): a sponsor could in principle
  -- have more than one alias of the same type (this importer never
  -- produces that today, but nothing about the shape forbids it), so
  -- the alias text itself is part of what makes a row unique, not just
  -- its type.
  unique (sponsor_id, alias_type, alias_name_normalized)
);

alter table public.sponsor_aliases enable row level security;

-- Same completed-import + active-sponsor visibility gate every other
-- sponsor-child table uses (sponsor_routes, migration 0050) — restated
-- here rather than assumed inherited, since Postgres RLS policies don't
-- compose across tables on their own.
create policy "Anyone can view aliases for a visible sponsor"
  on public.sponsor_aliases for select
  using (
    exists (
      select 1 from public.sponsors s
      join public.sponsor_imports si on si.id = s.import_id
      where s.id = sponsor_aliases.sponsor_id and s.is_active and si.status = 'completed'
    )
  );

create index sponsor_aliases_sponsor_id_idx on public.sponsor_aliases (sponsor_id);
create index sponsor_aliases_alias_name_normalized_idx on public.sponsor_aliases (alias_name_normalized);

-- Rounds out sponsor_imports' own result counts (sponsor_count,
-- route_count, migration 0049) with how many aliases this run produced.
alter table public.sponsor_imports add column alias_count integer check (alias_count is null or alias_count >= 0);
