-- Admin "View as user" impersonation — the live-session table the
-- security mechanism itself depends on (src/lib/auth/impersonation.ts):
-- one row per impersonation window, looked up by an opaque id stored in
-- a signed-nothing, purely-a-pointer httpOnly cookie. The cookie value
-- alone grants nothing — every read of this table is paired with a
-- fresh `auth.getUser()` check that the REAL, currently-authenticated
-- session's uid equals `admin_user_id` on the row, so a forged/guessed
-- cookie value is useless to anyone who isn't that specific admin's own
-- already-authenticated browser. Human-readable start/end audit
-- entries also go to the existing admin_audit_logs table
-- (logAdminAction) so they show up in /admin/audit-log alongside every
-- other privileged action — this table is the live-state mechanism,
-- not a replacement for that trail.
create table public.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason is null or char_length(end_reason) <= 100),
  created_at timestamptz not null default now()
);

create index admin_impersonation_sessions_admin_active_idx
  on public.admin_impersonation_sessions (admin_user_id) where (ended_at is null);
create index admin_impersonation_sessions_target_id_idx
  on public.admin_impersonation_sessions (target_user_id);

-- Defense in depth, not the primary gate (that's the application-level
-- check in src/lib/admin/impersonation/actions.ts, which reads the
-- target's role *before* this insert and returns a friendly error) —
-- this is what keeps the invariant true even if a future code path
-- ever inserts here without re-checking. Impersonation only ever
-- targets a plain 'user' account: never another admin (would let a
-- lesser-permissioned admin inherit a specific colleague's own
-- admin_role grants — a real privilege-escalation path) and never an
-- institution_admin (same reasoning, plus it isn't what "View as
-- user" is for).
create function public.check_impersonation_target_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.target_user_id and role = 'user'
  ) then
    raise exception 'Impersonation target must be a plain user account.';
  end if;
  return new;
end;
$$;

create trigger enforce_impersonation_target_role
  before insert on public.admin_impersonation_sessions
  for each row execute function public.check_impersonation_target_role();

alter table public.admin_impersonation_sessions enable row level security;

-- Read-only, and only for admins who hold manage_users (the same
-- permission /admin/users itself is gated behind) — lets that section
-- show "who's currently viewing as whom" if it ever wants to, without
-- opening this table to every admin regardless of section access.
-- No insert/update/delete policy at all, for any role: every write
-- goes through the server-only service-role client
-- (src/lib/admin/impersonation/actions.ts), never a session-bound one,
-- the same "not even the acting admin's own RLS-permitted client can
-- write this directly" boundary admin_audit_logs' insert-only policy
-- draws for a lower-stakes table than this one.
create policy "Admins with manage_users can view impersonation sessions"
  on public.admin_impersonation_sessions for select
  using (public.has_admin_permission(auth.uid(), 'manage_users'));
