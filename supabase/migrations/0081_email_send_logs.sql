-- A real record of every email this app has actually tried to send —
-- backing src/lib/email/resend.ts's sendEmail(), the single place
-- Resend is ever called from. Written only by that function, via the
-- service-role client (there's no authenticated "owner" of a system
-- send the way a user owns their own applications/CVs), and read by
-- admins through a dedicated permission.
--
-- Deliberately narrow columns — "safe" metadata only, matching this
-- session's own admin_audit_logs precedent (migration 0079): the
-- recipient address and which template sent (both already visible to
-- admins elsewhere, e.g. a user's own profile), the outcome, how many
-- attempts it took, and Resend's own short error *code* when it
-- failed. Never the subject line or HTML body — either could carry
-- real PII specific to that email (an application reminder's message,
-- a Quick Scan result, an institution invite's recipient context)
-- that this table has no reason to duplicate and retain indefinitely.
create type public.email_send_status as enum ('sent', 'failed');

create table public.email_send_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null check (char_length(recipient) <= 320),
  -- A short caller-supplied key identifying which template/purpose
  -- this was ("application_reminder", "institution_invite",
  -- "quick_scan_report") — free text like ai_usage_logs.operation and
  -- admin_audit_logs.action, for the same reason: the set of email
  -- templates this app sends only grows, and an enum would mean a
  -- migration every time one is added.
  template text not null check (char_length(template) between 1 and 100),
  status public.email_send_status not null,
  attempts smallint not null check (attempts > 0),
  -- Resend's own documented error code (e.g. "rate_limit_exceeded",
  -- "internal_server_error") — never the raw exception message, which
  -- could echo back request content.
  error_name text check (error_name is null or char_length(error_name) <= 100),
  created_at timestamptz not null default now()
);

alter table public.email_send_logs enable row level security;

-- No insert/update/delete policy for anon/authenticated at all —
-- sendEmail() writes this exclusively through the service-role client,
-- which bypasses RLS the same way every other system-owned log table
-- in this app does (ai_usage_logs' own write path, access_codes,
-- admin_audit_logs).
create policy "Admins with view_email_logs can view email logs"
  on public.email_send_logs for select
  using (public.has_admin_permission(auth.uid(), 'view_email_logs'));

create index email_send_logs_created_at_idx on public.email_send_logs (created_at desc);
create index email_send_logs_template_idx on public.email_send_logs (template);

-- One more fixed permission key (src/lib/admin/permission-types.ts is
-- the code-side source of truth), appended onto `super_admin` same as
-- every prior permission expansion in this app.
update public.admin_roles
set permissions = permissions || '["view_email_logs"]'::jsonb
where slug = 'super_admin';
