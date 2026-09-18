-- The Institutions module — flagged as not-yet-built by two earlier
-- migrations' own comments (0007_institution_admin_role.sql: "full
-- institution data model... belongs to the not-yet-built Institutions
-- module"; 0019_access_code_institutions_entitlements.sql: "Institution-
-- admin accounts aren't linked to a specific institution row yet").
-- This is that module's schema: institution_members (who belongs to
-- which institution, and with what role inside it), institution_licences
-- (the commercial grant — plan + seat count + validity window),
-- institution_domains (claimed email domains, for a future auto-join/
-- SSO-style signup flow — not built here, just the claim itself),
-- institution_invites (email invites, token-gated the same way
-- migration 0036's quick_scan_results already established: only a
-- SHA-256 hash is ever stored, never the raw token), plus branding
-- columns added directly onto the existing `institutions` row (logo,
-- primary colour, welcome message) since branding is inherently 1:1
-- with an institution — no separate table earns its keep for that.
--
-- "Tenant-safe RLS": every institution-scoped table's policies check
-- membership in *that specific* institution (via institution_members),
-- never just "is some kind of institution admin" — the same class of
-- bug 0051_profiles_role_immutable.sql closed for global role
-- escalation, here applied to cross-tenant access. The one deliberately
-- asymmetric table is institution_licences: institution admins can only
-- ever SELECT their own institution's licence rows (view their seat/
-- plan terms) — INSERT/UPDATE/DELETE stay JobPilot-admin-only, the same
-- reasoning access_codes' own capacity fields are never client-writable.
-- "Seats" isn't a separate inventory table — it's enforced as a real
-- constraint instead: enforce_institution_seat_capacity() (below) blocks
-- inserting a member or a still-pending invite once
-- (members + pending invites) >= the active licence's seat_count,
-- checked atomically per-row rather than trusted to application code,
-- the same "re-check capacity under the trigger, don't just trust the
-- caller" reasoning migration 0005's redeem_access_code already applies
-- to code redemption.
--
-- Required provisioning order, a direct consequence of seat capacity
-- being enforced rather than just displayed: create the institution
-- row, then its institution_licences row (seat_count > 0), *then* the
-- first institution_members row — enforce_institution_seat_capacity()
-- (below) requires an active licence to exist before any member (the
-- bootstrap admin included) or invite can be inserted.
--
-- Deliberately out of scope here (real follow-up work, not silently
-- dropped): wiring an institution's licence plan into
-- src/lib/entitlements/service.ts so members inherit it (today,
-- entitlements still only ever look at the personal `subscriptions`
-- table) — too large a change to fold into a schema migration; and any
-- actual admin UI beyond the existing /institution-admin placeholder
-- page, matching how every other schema-only migration this project has
-- shipped (e.g. 0063_applications_tracker.sql, 0067_test_prep.sql) left
-- CRUD/UI to its own later task.

create type public.institution_member_role as enum ('admin', 'member');

-- ---------------------------------------------------------------------
-- institution_members
-- ---------------------------------------------------------------------

-- One row per user, not per (institution, user): a person belongs to at
-- most one institution's licensed cohort at a time (`unique (user_id)`),
-- which is also what keeps "which institution's data am I allowed to
-- see" unambiguous for every policy below.
create table public.institution_members (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.institution_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.institution_members enable row level security;

-- Self-referencing on purpose (a row's own table, filtered by
-- institution_id + auth.uid()) — the standard Postgres/Supabase
-- multi-tenant "am I a member of this same tenant" idiom; it terminates
-- because the inner query is a simple equality-filtered exists, not a
-- cycle.
create policy "Institution members can view their own institution's roster"
  on public.institution_members for select
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_members.institution_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can add members"
  on public.institution_members for insert
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institution_members.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can update member roles"
  on public.institution_members for update
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_members.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institution_members.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Members can leave, admins can remove members"
  on public.institution_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.institution_members m where m.institution_id = institution_members.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create index institution_members_institution_id_idx on public.institution_members (institution_id);

-- ---------------------------------------------------------------------
-- institutions — branding + the RLS migration 0019 deferred
-- ---------------------------------------------------------------------

alter table public.institutions
  add column logo_url text check (logo_url is null or char_length(logo_url) <= 2048),
  add column primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  add column welcome_message text check (welcome_message is null or char_length(welcome_message) <= 2000),
  add column updated_at timestamptz not null default now();

create trigger set_institutions_updated_at
  before update on public.institutions
  for each row execute procedure public.set_updated_at();

-- Institution admins may edit their own row in full (name, slug,
-- branding alike) — a university updating its own display name or logo
-- isn't a security concern, it's self-service tenant management.
-- Provisioning a *new* institution from nothing stays JobPilot-admin-
-- only below: institution admins don't create their own tenant, they're
-- set up into one.
create policy "Institution members can view their own institution"
  on public.institutions for select
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institutions.id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can update their own institution"
  on public.institutions for update
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institutions.id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institutions.id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can insert institutions"
  on public.institutions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete institutions"
  on public.institutions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------
-- institution_licences
-- ---------------------------------------------------------------------

create table public.institution_licences (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  seat_count integer not null check (seat_count > 0),
  starts_at timestamptz not null default now(),
  -- Null means no fixed end date.
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

-- At most one active licence per institution — seat capacity is always
-- checked against *the* active licence below; two active at once would
-- make "how many seats does this institution have right now" ambiguous.
create unique index institution_licences_one_active_per_institution
  on public.institution_licences (institution_id) where (is_active);

alter table public.institution_licences enable row level security;

-- View-only for institution admins — deliberately asymmetric with every
-- other table here. Seat/plan terms are what JobPilot sold this
-- institution; letting an institution admin edit their own seat_count
-- would let them grant themselves more licensed capacity for free, the
-- same reasoning access_codes' own limits are never client-writable.
create policy "Institution admins can view their own licences"
  on public.institution_licences for select
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_licences.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can insert licences"
  on public.institution_licences for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update licences"
  on public.institution_licences for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete licences"
  on public.institution_licences for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create trigger set_institution_licences_updated_at
  before update on public.institution_licences
  for each row execute procedure public.set_updated_at();

create index institution_licences_institution_id_idx on public.institution_licences (institution_id);

-- ---------------------------------------------------------------------
-- institution_domains
-- ---------------------------------------------------------------------

create table public.institution_domains (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  -- Globally unique, not just per-institution: two institutions
  -- claiming the same email domain would make any future domain-based
  -- auto-join/SSO lookup ambiguous about which tenant a signup belongs
  -- to.
  domain text not null unique check (domain = lower(domain) and char_length(domain) between 3 and 255),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.institution_domains enable row level security;

create policy "Institution admins can view their own domains"
  on public.institution_domains for select
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_domains.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can claim domains"
  on public.institution_domains for insert
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institution_domains.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can remove their own domains"
  on public.institution_domains for delete
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_domains.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Verifying a domain (flipping is_verified to true) is deliberately
-- JobPilot-admin-only, not self-service — that flag is what a future
-- auto-join/SSO flow would trust, the same "a self-attested claim must
-- never self-verify itself" reasoning behind profiles.role's own
-- immutability (migration 0051).
create policy "Admins can verify domains"
  on public.institution_domains for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index institution_domains_institution_id_idx on public.institution_domains (institution_id);

-- ---------------------------------------------------------------------
-- institution_invites
-- ---------------------------------------------------------------------

create table public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 320),
  role public.institution_member_role not null default 'member',
  -- Only a SHA-256 hash is ever stored (src/lib/institutions/invite-
  -- token.ts) — same "possession of the raw token is the access
  -- control, so only its hash is persisted" reasoning migration 0036's
  -- quick_scan_results already established.
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Blocks a duplicate still-pending invite to the same email at the same
-- institution — partial rather than a plain unique(institution_id,
-- email), so the same person can legitimately be re-invited later (e.g.
-- their first invite lapsed, or they left and are rejoining) without
-- an admin having to first delete the old, already-resolved row.
create unique index institution_invites_pending_email_idx
  on public.institution_invites (institution_id, email) where (accepted_at is null);

alter table public.institution_invites enable row level security;

create policy "Institution admins can view their own invites"
  on public.institution_invites for select
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_invites.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can create invites"
  on public.institution_invites for insert
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institution_invites.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Covers resending/regenerating a still-pending invite's token. Letting
-- an institution admin also touch accepted_at/accepted_by on their own
-- invite rows this way carries no real exposure: actual access is only
-- ever granted through accept_institution_invite() below (which alone
-- creates the institution_members row a seat/role depends on) or
-- through this same admin's own already-legitimate insert rights on
-- institution_members — marking an invite row "accepted" by hand grants
-- nothing by itself.
create policy "Institution admins can update their own invites"
  on public.institution_invites for update
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_invites.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.institution_members m where m.institution_id = institution_invites.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Institution admins can revoke their own invites"
  on public.institution_invites for delete
  using (
    exists (select 1 from public.institution_members m where m.institution_id = institution_invites.institution_id and m.user_id = auth.uid() and m.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create index institution_invites_institution_id_idx on public.institution_invites (institution_id);

-- ---------------------------------------------------------------------
-- Seat capacity — enforced, not just displayed
-- ---------------------------------------------------------------------

-- Fires before a new member row, a new pending invite, or a member
-- switching institutions. "Seats used" = active members of the target
-- institution + its still-pending, unexpired invites (an outstanding
-- invite reserves a seat the moment it's sent, so capacity can't be
-- oversold between invite and acceptance). security definer + a fixed
-- search_path so it reads institution_licences/institution_members/
-- institution_invites directly rather than however RLS would filter
-- them for whichever role fired the triggering statement — the same
-- reasoning migration 0005's redeem_access_code is security definer.
create function public.enforce_institution_seat_capacity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_seat_count integer;
  v_seats_used integer;
begin
  select seat_count into v_seat_count
  from public.institution_licences
  where institution_id = new.institution_id and is_active
  limit 1;

  if v_seat_count is null then
    raise exception 'This institution has no active licence.' using errcode = '23514';
  end if;

  select
    (select count(*) from public.institution_members where institution_id = new.institution_id)
    + (select count(*) from public.institution_invites where institution_id = new.institution_id and accepted_at is null and expires_at > now())
  into v_seats_used;

  if v_seats_used >= v_seat_count then
    raise exception 'No seats remaining on this institution''s licence.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_seat_capacity_on_members
  before insert on public.institution_members
  for each row execute procedure public.enforce_institution_seat_capacity();

create trigger enforce_seat_capacity_on_member_institution_change
  before update of institution_id on public.institution_members
  for each row when (old.institution_id is distinct from new.institution_id)
  execute procedure public.enforce_institution_seat_capacity();

create trigger enforce_seat_capacity_on_invites
  before insert on public.institution_invites
  for each row execute procedure public.enforce_institution_seat_capacity();

-- ---------------------------------------------------------------------
-- Invite acceptance
-- ---------------------------------------------------------------------

-- Atomic accept: locks the matched pending, unexpired invite row, then
-- upserts the caller into institution_members (on conflict on its own
-- `unique (user_id)` — accepting a new invite while already a member
-- elsewhere *moves* that membership rather than erroring, consistent
-- with "one institution per user" above) and marks the invite accepted.
-- Returns null for an invalid/expired/already-accepted token rather
-- than raising, same convention as redeem_access_code.
--
-- Also promotes profiles.role to 'institution_admin' when the invite's
-- own role is 'admin' — the global gate src/lib/auth/session.ts's
-- requireInstitutionAdmin() checks before it resolves *which*
-- institution via institution_members. Guarded to only ever upgrade
-- from the default 'user' role, never downgrade an existing JobPilot
-- 'admin'. This write survives profiles' own role-immutability trigger
-- (migration 0051) for the same reason redeem_access_code's writes do:
-- that trigger only blocks `current_user in ('anon', 'authenticated')`,
-- and this function is only ever invoked via the service-role client
-- (grants below), never a direct authenticated request.
create function public.accept_institution_invite(p_token_hash text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_invite public.institution_invites%rowtype;
begin
  select * into v_invite
  from public.institution_invites
  where token_hash = p_token_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if v_invite.id is null then
    return null;
  end if;

  insert into public.institution_members (institution_id, user_id, role)
  values (v_invite.institution_id, p_user_id, v_invite.role)
  on conflict (user_id) do update
  set institution_id = excluded.institution_id,
      role = excluded.role,
      joined_at = now();

  update public.institution_invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = v_invite.id;

  if v_invite.role = 'admin' then
    update public.profiles set role = 'institution_admin' where id = p_user_id and role = 'user';
  end if;

  return jsonb_build_object('institution_id', v_invite.institution_id, 'role', v_invite.role);
end;
$$;

revoke execute on function public.accept_institution_invite(text, uuid) from public;
grant execute on function public.accept_institution_invite(text, uuid) to service_role;
