-- Cross-institution (multi-tenant) isolation — the highest-risk area in
-- the whole schema per this task's own audit: every institution-scoped
-- table's policy has to check membership in *that specific row's*
-- institution, never just "is some kind of institution admin" (the
-- same class of bug 0051_profiles_role_immutable.sql closed for global
-- role escalation, applied here to cross-tenant access — see migration
-- 0072_institutions_module.sql's own header comment, which states this
-- as the explicit design intent this file verifies).
--
-- Two institutions (X, Y), each with one admin and one regular member,
-- plus a platform (JobPilot) admin as a positive control. Provisioning
-- order matches the real required order the seat-capacity trigger
-- enforces (institution -> licence -> members), per that migration's
-- own comment.

begin;

select plan(31);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------

select tests.create_user('aa111111-1111-1111-1111-111111111111', 'admin-x@test.local');
select tests.create_user('aa222222-2222-2222-2222-222222222222', 'member-x@test.local');
select tests.create_user('bb111111-1111-1111-1111-111111111111', 'admin-y@test.local');
select tests.create_user('bb222222-2222-2222-2222-222222222222', 'member-y@test.local');
select tests.create_user('cc111111-1111-1111-1111-111111111111', 'platform-admin@test.local');
update public.profiles set role = 'admin' where id = 'cc111111-1111-1111-1111-111111111111';

insert into public.institutions (id, name, slug) values ('a0000000-0000-0000-0000-000000000001', 'Institution X', 'institution-x-pgtap');
insert into public.institutions (id, name, slug) values ('b0000000-0000-0000-0000-000000000001', 'Institution Y', 'institution-y-pgtap');

insert into public.plans (id, slug, name, tier_order, monthly_price_pence, annual_price_pence)
  values ('e0000000-0000-0000-0000-00000000000f', 'pgtap-institution-test-plan', 'pgTAP Institution Test Plan', 32766, 0, 0);

insert into public.institution_licences (id, institution_id, plan_id, seat_count)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000f', 10);
insert into public.institution_licences (id, institution_id, plan_id, seat_count)
  values ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000f', 10);

insert into public.institution_members (institution_id, user_id, role) values ('a0000000-0000-0000-0000-000000000001', 'aa111111-1111-1111-1111-111111111111', 'admin');
insert into public.institution_members (institution_id, user_id, role) values ('a0000000-0000-0000-0000-000000000001', 'aa222222-2222-2222-2222-222222222222', 'member');
insert into public.institution_members (institution_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'bb111111-1111-1111-1111-111111111111', 'admin');
insert into public.institution_members (institution_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'bb222222-2222-2222-2222-222222222222', 'member');

insert into public.institution_domains (id, institution_id, domain) values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'institution-x-pgtap.example');
insert into public.institution_domains (id, institution_id, domain) values ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'institution-y-pgtap.example');

insert into public.institution_invites (id, institution_id, email, token_hash) values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'invitee-x@test.local', repeat('a', 64));
insert into public.institution_invites (id, institution_id, email, token_hash) values ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'invitee-y@test.local', repeat('b', 64));

select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------

select tests.authenticate_as('aa111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.institutions', 'id', 'a0000000-0000-0000-0000-000000000001', 'an institution admin can select their own institution');
select tests.assert_select_denied('public.institutions', 'id', 'b0000000-0000-0000-0000-000000000001', 'an institution admin cannot select a different institution');
select tests.assert_update_denied('public.institutions', 'id', 'b0000000-0000-0000-0000-000000000001', 'welcome_message = ''Hijacked''', 'an institution admin cannot update a different institution');
update public.institutions set welcome_message = 'Welcome!' where id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select welcome_message from public.institutions where id = 'a0000000-0000-0000-0000-000000000001'),
  'Welcome!',
  'an institution admin CAN update their own institution (positive control)'
);
select tests.clear_authentication();

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_select_visible('public.institutions', 'id', 'a0000000-0000-0000-0000-000000000001', 'a regular member can view their own institution');
select tests.assert_select_denied('public.institutions', 'id', 'b0000000-0000-0000-0000-000000000001', 'a regular member cannot select a different institution');
select tests.assert_update_denied('public.institutions', 'id', 'a0000000-0000-0000-0000-000000000001', 'welcome_message = ''Hijacked''', 'a regular (non-admin) member cannot update their own institution');
select tests.clear_authentication();

select tests.authenticate_as('cc111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.institutions', 'id', 'a0000000-0000-0000-0000-000000000001', 'the platform admin can select institution X');
select tests.assert_select_visible('public.institutions', 'id', 'b0000000-0000-0000-0000-000000000001', 'the platform admin can select institution Y too');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- institution_members
-- ---------------------------------------------------------------------

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_select_visible('public.institution_members', 'user_id', 'aa111111-1111-1111-1111-111111111111', 'a regular member can see a fellow member''s roster row in their own institution');
select tests.assert_select_denied('public.institution_members', 'user_id', 'bb111111-1111-1111-1111-111111111111', 'a regular member cannot see another institution''s roster row');
select tests.clear_authentication();

select tests.authenticate_as('aa111111-1111-1111-1111-111111111111');
select throws_ok(
  $$insert into public.institution_members (institution_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'aa111111-1111-1111-1111-111111111111', 'member')$$,
  '42501',
  'an institution admin cannot add a member to a different institution'
);
select tests.assert_update_denied('public.institution_members', 'user_id', 'bb222222-2222-2222-2222-222222222222', 'role = ''admin''', 'an institution admin cannot change a member''s role in a different institution');
select tests.assert_delete_denied('public.institution_members', 'user_id', 'bb111111-1111-1111-1111-111111111111', 'an institution admin cannot remove a member from a different institution');
select tests.clear_authentication();

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_delete_denied('public.institution_members', 'user_id', 'aa111111-1111-1111-1111-111111111111', 'a regular member cannot remove a fellow member (only self-leave or admin)');
select tests.assert_delete_allowed('public.institution_members', 'user_id', 'aa222222-2222-2222-2222-222222222222', 'a member CAN remove themselves (self-leave, positive control)');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- institution_licences — deliberately view-only, even for the
-- institution's own admin (migration 0072's own stated reasoning: an
-- institution admin editing their own seat_count would let them grant
-- themselves free capacity).
-- ---------------------------------------------------------------------

select tests.authenticate_as('aa111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.institution_licences', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'an institution admin can view their own institution''s licence');
select tests.assert_select_denied('public.institution_licences', 'institution_id', 'b0000000-0000-0000-0000-000000000001', 'an institution admin cannot view a different institution''s licence');
select tests.assert_update_denied('public.institution_licences', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'seat_count = 999', 'an institution admin cannot update even their own institution''s licence (view-only by design)');
select tests.clear_authentication();

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.institution_licences', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'a regular (non-admin) member cannot view their own institution''s licence');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- institution_domains
-- ---------------------------------------------------------------------

select tests.authenticate_as('aa111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.institution_domains', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'an institution admin can view their own institution''s claimed domain');
select tests.assert_select_denied('public.institution_domains', 'institution_id', 'b0000000-0000-0000-0000-000000000001', 'an institution admin cannot view a different institution''s claimed domain');
select throws_ok(
  $$insert into public.institution_domains (institution_id, domain) values ('b0000000-0000-0000-0000-000000000001', 'sneaky-claim-pgtap.example')$$,
  '42501',
  'an institution admin cannot claim a domain for a different institution'
);
select tests.assert_update_denied('public.institution_domains', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'is_verified = true', 'an institution admin cannot verify even their own institution''s domain (JobPilot-admin-only)');
select tests.clear_authentication();

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.institution_domains', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'a regular (non-admin) member cannot view their own institution''s claimed domain');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- institution_invites
-- ---------------------------------------------------------------------

select tests.authenticate_as('aa111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.institution_invites', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'an institution admin can view their own institution''s invite');
select tests.assert_select_denied('public.institution_invites', 'institution_id', 'b0000000-0000-0000-0000-000000000001', 'an institution admin cannot view a different institution''s invite');
select throws_ok(
  $$insert into public.institution_invites (institution_id, email, token_hash) values ('b0000000-0000-0000-0000-000000000001', 'sneaky-invite@test.local', repeat('c', 64))$$,
  '42501',
  'an institution admin cannot create an invite for a different institution'
);
select tests.assert_update_denied('public.institution_invites', 'institution_id', 'b0000000-0000-0000-0000-000000000001', 'role = ''admin''', 'an institution admin cannot update a different institution''s invite');
select tests.assert_delete_denied('public.institution_invites', 'institution_id', 'b0000000-0000-0000-0000-000000000001', 'an institution admin cannot revoke a different institution''s invite');
select tests.clear_authentication();

select tests.authenticate_as('aa222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.institution_invites', 'institution_id', 'a0000000-0000-0000-0000-000000000001', 'a regular (non-admin) member cannot view their own institution''s invites');
select tests.clear_authentication();

select * from finish();
rollback;
