-- Fixes a real privilege-escalation gap: profiles' own UPDATE policy
-- (0001_profiles.sql) is `using (auth.uid() = id)` with no `with check`,
-- which restricts which *row* a client can touch but nothing about
-- which *columns* — so an authenticated client can currently call
-- `update profiles set role = 'admin' where id = auth.uid()` and RLS
-- lets it straight through. `role` is what src/lib/auth/session.ts's
-- requireAdmin()/requireInstitutionAdmin() gate every /admin and
-- /institution-admin route on, so this is a real path to self-granting
-- admin access, not a theoretical one.
--
-- Why a trigger, not a tighter `with check` — an RLS policy's `with
-- check` only ever sees the *new* row being written; it has no built-in
-- way to compare it against the row's previous value, so it cannot
-- express "id must match, and role must not have changed" — only
-- "id must match" (which is the same, insufficient check already in
-- place) or "role must equal some fixed literal" (which would break
-- every legitimate role transition, including the one this migration
-- exists to keep working: service-role promotion). A `BEFORE UPDATE`
-- trigger has real access to both OLD and NEW, which is what this
-- actually requires. This is the standard, least-invasive Postgres
-- pattern for "let a user update their own row, but not every column of
-- it" — no table split, no second table, no rewritten policy.
--
-- Columns protected, and why each qualifies as authorization-related
-- (checked by reading every migration that ever touched `profiles`, not
-- assumed):
--   - `role` — the actual authorization gate (requireAdmin/
--     requireInstitutionAdmin). The one this task was filed over.
--   - `plan` (0009_profiles_plan.sql) — a legacy free/paid flag, kept in
--     sync automatically by sync_profile_plan_from_subscription
--     (0015_billing.sql) and never written by any user-facing Server
--     Action in this codebase. The *real* entitlement gate today is
--     src/lib/entitlements/service.ts, which reads the `subscriptions`
--     table, not this column — but `plan` still backs at least one
--     display surface (BillingPanel's fallback) implying paid status,
--     and locking it down now costs nothing and closes the same class
--     of gap before it becomes a real one.
--   No `institution_id` or other institution/admin-ownership column
--   exists on `profiles` today (0007_institution_admin_role.sql only
--   added the enum value — "full institution data model... belongs to
--   the not-yet-built Institutions module", per that migration's own
--   comment) — nothing to protect there yet. If/when that module adds
--   one, add it to the check below in the same migration that adds the
--   column, not as an afterthought.
--   Explicitly NOT protected: `full_name`, `date_of_birth`,
--   `onboarding_status`, `newsletter_opt_in`/`newsletter_opt_in_at` —
--   every one of these is written directly by a real, existing
--   authenticated-client Server Action today (src/lib/settings/
--   actions.ts, src/lib/onboarding/actions.ts) and none of them confer
--   any privilege; locking them down would break real functionality for
--   no security benefit.
--
-- Who's exempt, and why this is the right boundary: only Postgres roles
-- `anon` and `authenticated` — the two PostgREST assigns to actual API
-- callers (an anonymous request and a signed-in user's own RLS-governed
-- request, respectively) — are ever restricted below. Every other
-- Postgres role is trusted unconditionally: `service_role` (what
-- scripts/promote-admin.mjs and every other trusted server-side write in
-- this app already uses — Stripe webhooks, the sponsor-register
-- importer), and whatever role migrations/the Supabase SQL editor run as
-- (commonly `postgres`) — both covering docs/ADMIN_PROMOTION.md's two
-- documented promotion paths. A deny-list of the two known-restricted
-- roles is deliberately used instead of an allow-list naming every
-- privileged role by name: Postgres role names for "the project owner"
-- vary across Supabase project generations, and a missed name in an
-- allow-list fails closed in the *wrong* direction here (it would lock
-- out a legitimate operator), whereas this deny-list can't accidentally
-- do that. `current_user` — the actual Postgres role executing the
-- statement — is used rather than auth.role() (a JWT-claim helper that's
-- meaningless outside a PostgREST request, e.g. a plain psql/migration
-- session): a `security definer` function's body executes with the
-- *function owner's* current_user, but that's exactly the property that
-- makes sync_profile_plan_from_subscription's own internal `profiles`
-- update keep working here unchanged — it runs inside a service-role-
-- initiated request (subscriptions has no client-writable policy at
-- all), so `current_user` at the point its UPDATE fires is still
-- whatever privileged role initiated that whole request, never `anon`/
-- `authenticated`.

create function public.prevent_profiles_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.role is distinct from old.role then
      raise exception 'Changing role is not permitted.' using errcode = '42501';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'Changing plan is not permitted.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger prevent_profiles_privilege_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profiles_privilege_escalation();
