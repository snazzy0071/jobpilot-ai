-- Configurable admin RBAC — layered *on top of* the existing
-- `profiles.role` gate, not a replacement for it. `profiles.role` stays
-- exactly what it's always been (scripts/promote-admin.mjs's own header
-- comment: a fixed three-value enum, 'admin' the highest tier that
-- exists) — that's still the coarse "is this a JobPilot staff account
-- at all" boundary, immutable to its own owner (migration 0051). What's
-- new here is *within* that: which specific admin areas a given staff
-- account can actually touch, via a configurable set of roles rather
-- than a hardcoded role name checked in the UI.
--
-- Mirrors the split this app already uses for billing entitlements
-- (src/lib/entitlements/service.ts): `plans.entitlements` is
-- configurable data, but the feature *keys* it can contain
-- (`FeatureKey`) are fixed in code, because each one corresponds to a
-- real, already-written gated code path — a "permission" nobody checks
-- for isn't a permission, it's a typo. Same split here:
-- `admin_roles.permissions` (jsonb array) is configurable — an admin
-- with the right role can create/edit/delete roles and choose which of
-- the fixed permission keys each one grants — but the permission keys
-- themselves (src/lib/admin/permissions.ts's own ADMIN_PERMISSIONS)
-- are code.
--
-- has_admin_permission() exists as a shared function, not inlined at
-- every call site the way this app's own `role = 'admin'` checks
-- usually are, because it's used from *inside* RLS policies on two
-- different tables below — a security-critical predicate duplicated
-- across policies risks silently drifting between copies, which is a
-- worse failure mode than the usual "no premature abstraction" default
-- this app follows elsewhere.

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) <= 100),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 2000),
  permissions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

-- Any admin can see which roles exist and what they grant (low
-- sensitivity, and genuinely useful context for every admin) — only
-- *writing* admin_roles needs the manage_admin_roles permission itself,
-- checked below via has_admin_permission(), defined further down.
create policy "Admins can view admin roles"
  on public.admin_roles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create trigger set_admin_roles_updated_at
  before update on public.admin_roles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- admin_user_roles
-- ---------------------------------------------------------------------

-- Many-to-many: a staff account can hold more than one role, and its
-- effective permissions are the union of all of them.
-- `unique (user_id, admin_role_id)` just prevents a duplicate grant, not
-- one user holding several different roles.
create table public.admin_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  admin_role_id uuid not null references public.admin_roles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, admin_role_id)
);

alter table public.admin_user_roles enable row level security;

create policy "Admins can view admin role assignments"
  on public.admin_user_roles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index admin_user_roles_user_id_idx on public.admin_user_roles (user_id);

-- A role can only ever be granted to an account that's already flagged
-- profiles.role = 'admin' — this is what keeps the two layers coherent:
-- admin_roles/admin_user_roles describe what a *staff account* can do
-- within the admin area, never a way to hand admin-area capabilities to
-- an account that was never made staff in the first place. Real
-- defense in depth, not just belt-and-suspenders: requirePermission()
-- (src/lib/admin/permissions.ts) already calls requireAdmin() before
-- ever checking a specific permission, so this trigger's failure mode
-- would otherwise only be reachable by a future code path that checks
-- has_admin_permission() without that base gate first.
create function public.enforce_admin_user_role_requires_admin_flag()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and role = 'admin') then
    raise exception 'Admin roles can only be granted to an account already flagged profiles.role = ''admin''.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_admin_user_role_requires_admin_flag
  before insert on public.admin_user_roles
  for each row execute procedure public.enforce_admin_user_role_requires_admin_flag();

-- ---------------------------------------------------------------------
-- has_admin_permission() — the one shared predicate
-- ---------------------------------------------------------------------

-- jsonb containment (`@>`) treats a scalar right-hand side as "does
-- this appear as an element of the left-hand array" — exactly
-- `permissions @> to_jsonb(p_permission)` needs. `stable` (not
-- `volatile`) since it only reads, which lets the planner call it once
-- per row rather than assuming it could change mid-query — same
-- category as any other read-only lookup function.
create function public.has_admin_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_user_roles ur
    join public.admin_roles r on r.id = ur.admin_role_id
    where ur.user_id = p_user_id
      and r.is_active
      and r.permissions @> to_jsonb(p_permission)
  );
$$;

-- Needs to be callable both by application code (an authenticated
-- session checking its own permissions) and, implicitly, by whatever
-- role is evaluating the policies below that call it — `authenticated`
-- covers a real signed-in user's own request either way.
revoke execute on function public.has_admin_permission(uuid, text) from public;
grant execute on function public.has_admin_permission(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- The rest of admin_roles'/admin_user_roles' own write policies —
-- defined after has_admin_permission() exists, since they call it.
-- ---------------------------------------------------------------------

create policy "Admins with manage_admin_roles can insert admin roles"
  on public.admin_roles for insert
  with check (public.has_admin_permission(auth.uid(), 'manage_admin_roles'));

create policy "Admins with manage_admin_roles can update admin roles"
  on public.admin_roles for update
  using (public.has_admin_permission(auth.uid(), 'manage_admin_roles'))
  with check (public.has_admin_permission(auth.uid(), 'manage_admin_roles'));

create policy "Admins with manage_admin_roles can delete admin roles"
  on public.admin_roles for delete
  using (public.has_admin_permission(auth.uid(), 'manage_admin_roles'));

create policy "Admins with manage_admin_roles can assign admin roles"
  on public.admin_user_roles for insert
  with check (public.has_admin_permission(auth.uid(), 'manage_admin_roles'));

create policy "Admins with manage_admin_roles can revoke admin roles"
  on public.admin_user_roles for delete
  using (public.has_admin_permission(auth.uid(), 'manage_admin_roles'));

-- ---------------------------------------------------------------------
-- Seed + backfill — every *currently* admin account keeps full access
-- ---------------------------------------------------------------------

-- Without this, shipping permission-gated admin pages in the same
-- release would lock every existing admin out of everything except the
-- bare overview the moment this migration runs, since nobody would yet
-- hold any admin_role at all. super_admin is seeded with every
-- permission key that exists today and backfilled onto every account
-- already flagged profiles.role = 'admin' — a real, permanent role
-- (editable/removable later like any other), not a one-off script.
insert into public.admin_roles (slug, name, description, permissions)
values (
  'super_admin',
  'Super Admin',
  'Full access to every admin area.',
  '["manage_users", "manage_graduate_schemes", "manage_test_prep", "manage_admin_roles"]'::jsonb
);

insert into public.admin_user_roles (user_id, admin_role_id)
select p.id, r.id
from public.profiles p
cross join (select id from public.admin_roles where slug = 'super_admin') r
where p.role = 'admin';
