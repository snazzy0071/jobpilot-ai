-- Fixes: "infinite recursion detected in policy for relation
-- institution_members" — a real, reproducible error from the 4
-- self-referencing policies 0072_institutions_module.sql defined on
-- institution_members (SELECT/INSERT/UPDATE/DELETE), each checking
-- "is auth.uid() a member of this same institution" via a subquery
-- against institution_members from *within* institution_members' own
-- policy. That migration's comment claimed this "terminates because
-- it's a simple equality-filtered exists, not a cycle" — true of the
-- query's logic, but not of how Postgres's RLS planner treats it once
-- a plan gets reused: it fails on a fresh connection's first read, then
-- reliably on every read after — exactly what turned up while testing
-- the institution_admin role's post-login redirect (an existing
-- institution_admin visiting /institution-admin a second time got
-- bounced out by this, unrelated to anything about that redirect
-- logic itself).
--
-- Fix: move the membership check into a SECURITY DEFINER function.
-- Called from inside a policy, its own internal query against
-- institution_members runs as the function's owner, bypassing RLS on
-- institution_members entirely for that one lookup — which is what
-- actually breaks the self-referential chain, not a workaround for it.
-- This is the standard, documented Postgres/Supabase pattern for a
-- table whose own RLS policy needs to query itself. Every other table
-- in this module (institutions, institution_licences,
-- institution_domains, institution_invites) already only ever
-- cross-references institution_members, not itself — their policies
-- are unaffected by this bug directly, and pick up this same fix
-- transitively once institution_members' own policies stop recursing.

create or replace function public.is_institution_member(p_institution_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.institution_members m
    where m.institution_id = p_institution_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_institution_member(uuid) from public;
grant execute on function public.is_institution_member(uuid) to authenticated;

create or replace function public.is_institution_member_admin(p_institution_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.institution_members m
    where m.institution_id = p_institution_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

revoke all on function public.is_institution_member_admin(uuid) from public;
grant execute on function public.is_institution_member_admin(uuid) to authenticated;

drop policy "Institution members can view their own institution's roster" on public.institution_members;
create policy "Institution members can view their own institution's roster"
  on public.institution_members for select
  using (
    public.is_institution_member(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy "Institution admins can add members" on public.institution_members;
create policy "Institution admins can add members"
  on public.institution_members for insert
  with check (
    public.is_institution_member_admin(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy "Institution admins can update member roles" on public.institution_members;
create policy "Institution admins can update member roles"
  on public.institution_members for update
  using (
    public.is_institution_member_admin(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    public.is_institution_member_admin(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy "Members can leave, admins can remove members" on public.institution_members;
create policy "Members can leave, admins can remove members"
  on public.institution_members for delete
  using (
    auth.uid() = user_id
    or public.is_institution_member_admin(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
