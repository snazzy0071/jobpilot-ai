-- Five more fixed permission keys for this task's new admin sections
-- (src/lib/admin/permission-types.ts's own ADMIN_PERMISSIONS is the
-- code-side source of truth): `view_sponsor_sync` and `view_job_sync`
-- (both read-only observability pages — neither pipeline gets a
-- manual "run now" button here, since that would need a new
-- privileged endpoint beyond what this task asked for, not just a UI
-- change), `manage_blog` (the admin CMS blog_posts' own migration
-- 0010 comment already said didn't exist yet), `view_leads`
-- (newsletter_subscribers/contact_messages/demo_requests/
-- partner_inquiries — four public-insert-only tables whose own
-- migrations already said "nobody but future admin tooling can read
-- submissions back"; this is that tooling), and `manage_settings`
-- (the new app_settings singleton below). Appended onto `super_admin`,
-- same pattern every prior permission expansion in this app follows.
update public.admin_roles
set permissions = permissions || '["view_sponsor_sync", "view_job_sync", "manage_blog", "view_leads", "manage_settings"]'::jsonb
where slug = 'super_admin';

-- ---------------------------------------------------------------------
-- app_settings — a real, singleton "global settings" row
-- ---------------------------------------------------------------------

-- A single-row table (enforced by `id` having exactly one allowed
-- value via the check constraint below, rather than a separate
-- "is this the row" flag) rather than an open-ended key/value store —
-- every field here is wired into a real consumer, not a speculative
-- knob nobody reads:
--   - `maintenance_mode`: checked by signUpWithPassword
--     (src/lib/auth/actions.ts) to actually pause new signups, not
--     just displayed somewhere.
--   - `announcement_message`/`announcement_active`: rendered as a
--     real banner in the dashboard layout
--     (src/app/(dashboard)/layout.tsx) when active.
-- Deliberately not a bigger generic settings blob (jsonb of arbitrary
-- keys) — that shape invites exactly the "field nobody actually reads"
-- problem this table is designed to avoid.
create table public.app_settings (
  id integer primary key default 1,
  maintenance_mode boolean not null default false,
  announcement_message text check (announcement_message is null or char_length(announcement_message) <= 500),
  announcement_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (id = 1)
);

insert into public.app_settings (id) values (1);

alter table public.app_settings enable row level security;

-- Public read: signUpWithPassword needs to check maintenance_mode
-- before a session even exists (an anonymous request), and the
-- announcement banner needs to render for every signed-in user, not
-- just admins — neither field is sensitive.
create policy "Anyone can view app settings"
  on public.app_settings for select
  using (true);

create policy "Admins with manage_settings can update app settings"
  on public.app_settings for update
  using (public.has_admin_permission(auth.uid(), 'manage_settings'))
  with check (public.has_admin_permission(auth.uid(), 'manage_settings'));

create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute procedure public.set_updated_at();
