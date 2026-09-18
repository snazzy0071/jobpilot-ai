-- Admin write access for graduate_schemes (src/app/admin/graduate-
-- schemes/*, src/lib/graduate-schemes/actions.ts) — real RLS policies,
-- not just an application-level check. requireAdmin()
-- (src/lib/auth/session.ts) already gates every /admin/* route, but
-- that's a redirect, not a permission boundary the database itself
-- enforces; per this project's "RLS on every table" rule the actual
-- authority has to live here too, same spirit as migration 0051's
-- profiles-role trigger.
--
-- Gated on profiles.role = 'admin' for the requesting user, read via
-- their own profiles row — allowed under that table's existing "select
-- own profile" policy (auth.uid() = id), so no security definer/
-- recursion concern. Content stays curated rather than synced from an
-- automated feed (this migration's own 0056 header comment already
-- covers why), so writes are scoped to admins specifically, not any
-- authenticated user the way a user-owned table like linkedin_profile_
-- drafts is scoped to auth.uid() = user_id.

create policy "Admins can insert graduate schemes"
  on public.graduate_schemes for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can update graduate schemes"
  on public.graduate_schemes for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can delete graduate schemes"
  on public.graduate_schemes for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
