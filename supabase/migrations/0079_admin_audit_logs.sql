-- Append-only audit trail for privileged admin actions — account
-- deletion, subscription cancellation, admin-role grants/revocations,
-- access-code creation, institution/licence provisioning, and global
-- settings changes (the actions actually instrumented are listed in
-- docs/BUILD_CHECKLIST.md; blog/lead moderation is deliberately not,
-- as lower-severity content actions rather than security/access/
-- billing ones).
--
-- "No normal UPDATE/DELETE access" is enforced the same way this
-- app enforces every other hard invariant when RLS alone can't
-- express it cleanly: by never defining an UPDATE or DELETE policy at
-- all. RLS defaults to deny for any operation with no matching
-- policy, for every role that isn't exempt from RLS entirely
-- (`service_role`/`postgres`, the same "trusted unconditionally"
-- exemption migration 0051's own comment documents — nothing short of
-- direct database access can alter or remove a row here, which is the
-- actual point of an audit log).
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),

  -- Nullable + on delete set null: an actor's account being deleted
  -- later (itself possibly one of these very audit entries) must never
  -- erase the record that they took this action — same "losing the
  -- link is fine, losing the record isn't" reasoning already applied
  -- throughout this app (applications.cv_id, saved_jobs.job_id, every
  -- institution back-reference). `actor_email` is a snapshot taken at
  -- the moment of the action for exactly that reason: it's what keeps
  -- the log forensically readable ("who did this") even after the
  -- actor_id link is gone.
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text check (actor_email is null or char_length(actor_email) <= 320),

  -- A namespaced string ("user.delete", "admin_role.grant",
  -- "app_settings.update") rather than an enum — the set of privileged
  -- actions this app instruments grows with every admin feature added,
  -- and an enum would mean a migration per new action logged. Same
  -- "free text where an enum would need constant amendment" reasoning
  -- ai_usage_logs.operation already uses.
  action text not null check (char_length(action) between 1 and 200),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  -- Text, not uuid: every entity in this app happens to have a uuid
  -- primary key today, but this table shouldn't need a migration if
  -- that ever isn't true. Nullable for an action with no single target
  -- row (e.g. updating the app_settings singleton, which is arguably
  -- always id=1 but not every future action will have an id at all).
  entity_id text,

  -- Deliberately "safe" metadata only — never a raw secret (an invite
  -- token, a Stripe key, a password). What's safe to log is a judgment
  -- call made once per call site (src/lib/admin/audit/log.ts's own
  -- callers), not something this column can enforce by itself.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

-- Insert-only, and only for an admin logging *themselves* as the
-- actor — `actor_id` must equal the caller's own auth.uid(), so this
-- can never be used to forge someone else's name onto an action they
-- didn't take. Nothing below defines an update or delete policy at
-- all, which is what actually makes this append-only.
create policy "Admins can log their own audit entries"
  on public.admin_audit_logs for insert
  with check (
    auth.uid() = actor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Reading the audit trail is its own gated permission, not folded into
-- manage_admin_roles or any other existing one — overseeing what every
-- admin has actually done is a distinct capability from any single
-- thing they might do.
create policy "Admins with view_audit_logs can view audit entries"
  on public.admin_audit_logs for select
  using (public.has_admin_permission(auth.uid(), 'view_audit_logs'));

create index admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_actor_id_idx on public.admin_audit_logs (actor_id);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);

-- One more fixed permission key (src/lib/admin/permission-types.ts is
-- the code-side source of truth), appended onto `super_admin` same as
-- every prior permission expansion in this app.
update public.admin_roles
set permissions = permissions || '["view_audit_logs"]'::jsonb
where slug = 'super_admin';
