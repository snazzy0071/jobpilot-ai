-- Two things this file exists to prove, together, because they share
-- fixtures:
--   1. RLS-sensitive CRUD on the two tables redeem_access_code() and the
--      Stripe webhook idempotency path (src/lib/billing/sync.ts) write to
--      that no earlier numbered file covers yet: access_code_redemptions
--      and billing_events. Same cross-user pattern as
--      10_cross_user_isolation.sql, just for these two specifically.
--   2. redeem_access_code()'s own business rules (migrations 0005/0018/
--      0019/0073) — one-time use, a max_redemptions cap, expiry,
--      inactive codes, never overwriting an existing *paid* subscription,
--      and never double-joining an institution — none of which is
--      expressible as an RLS policy at all; this is the function's
--      actual control flow, checked against real Postgres semantics
--      (atomic UPDATE ... WHERE ... RETURNING, unhandled-exception
--      rollback, ON CONFLICT DO NOTHING).
--
-- Called authenticated as service_role throughout, not as an individual
-- user: this function's EXECUTE privilege is deliberately not granted to
-- anon/authenticated (see 50_regressions.sql) — every real caller
-- (src/lib/auth/actions.ts at signup,
-- src/lib/institutions/enrollment/actions.ts for an existing account)
-- goes through the service-role admin client and passes p_user_id
-- explicitly, never relies on auth.uid(). Calling it as `authenticated`
-- here would test a calling convention the app never actually uses.
--
-- access_code_redemptions.user_id is UNIQUE (a real person redeems at
-- most one code, ever) — every fixture user below is therefore used for
-- at most one *successful* redemption; a user whose attempt returns
-- null (expired/inactive/exhausted code) never actually consumes a row,
-- so those are safe to layer multiple failed attempts onto the same
-- user, but a user who does succeed once is never reused for a second
-- redemption attempt anywhere else in this file.
--
-- NOTE: not executed in the environment this was written in — same
-- standing Docker/Supabase-CLI blocker as every other file in this
-- suite (see 00_helpers.sql's own note). Every table/column/function
-- referenced was checked against the real migration files.

begin;

select plan(25);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------

-- 001: redeems PGTAP-PLAIN, later re-attempts (must throw).
-- 002: redeems PGTAP-SINGLE-USE (exhausting it).
-- 003: only ever hits dead-end codes (single-use once exhausted, expired,
--      inactive) — every attempt returns null, so never actually
--      consumes this user's one-redemption-ever slot.
-- 004: redeems PGTAP-GRANTS-INSTITUTION fresh (no institution yet).
-- 005: already a real, paying Stripe subscriber; redeems
--      PGTAP-GRANTS-PLAN (must not be overwritten).
-- 006: already a member of a *different* institution (added directly,
--      not via redemption); redeems PGTAP-GRANTS-INSTITUTION (must not
--      switch or duplicate membership).
-- 007: fresh user with no subscription; redeems PGTAP-GRANTS-PLAN.
select tests.create_user('a1000000-0000-0000-0000-000000000001', 'redeemer-a@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000002', 'redeemer-b@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000003', 'redeemer-c@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000004', 'redeemer-d@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000005', 'already-paid@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000006', 'already-in-other-institution@test.local');
select tests.create_user('a1000000-0000-0000-0000-000000000007', 'fresh-plan-grantee@test.local');

insert into public.plans (id, slug, name, tier_order, monthly_price_pence, annual_price_pence)
  values ('b1000000-0000-0000-0000-000000000001', 'pgtap-redemption-pro', 'pgTAP Redemption Pro', 10, 500, 5000);

insert into public.institutions (id, name, slug) values
  ('c1000000-0000-0000-0000-000000000001', 'pgTAP Test University', 'pgtap-test-university'),
  ('c1000000-0000-0000-0000-000000000002', 'pgTAP Other University', 'pgtap-other-university');

insert into public.institution_licences (id, institution_id, plan_id, seat_count) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 5),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 5);

-- User 006 already a member of "Other University" *without* ever having
-- called redeem_access_code (simulating accept_institution_invite() or
-- direct provisioning) — so redeeming an institution code below exercises
-- the ON CONFLICT DO NOTHING path without also tripping the one-
-- redemption-per-user constraint tested separately below.
insert into public.institution_members (institution_id, user_id, role)
  values ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 'member');

-- User 005: a real, currently-paying Stripe subscriber — redeeming a
-- plan-granting code must never touch this.
insert into public.subscriptions (user_id, plan_id, status, stripe_subscription_id)
  values ('a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'active', 'sub_pgtap_real_paid_123');

insert into public.access_codes (id, code, label, max_redemptions, is_active) values
  ('e1000000-0000-0000-0000-000000000001', 'PGTAP-PLAIN', 'Plain, unlimited code', null, true),
  ('e1000000-0000-0000-0000-000000000002', 'PGTAP-SINGLE-USE', 'Max one redemption', 1, true),
  ('e1000000-0000-0000-0000-000000000003', 'PGTAP-EXPIRED', 'Expired code', null, true),
  ('e1000000-0000-0000-0000-000000000004', 'PGTAP-INACTIVE', 'Deactivated code', null, false);
update public.access_codes set expires_at = now() - interval '1 day' where id = 'e1000000-0000-0000-0000-000000000003';

-- Both unlimited (max_redemptions null) so two different fixture users
-- can each redeem the same one below.
insert into public.access_codes (id, code, label, granted_plan_id) values
  ('e1000000-0000-0000-0000-000000000005', 'PGTAP-GRANTS-PLAN', 'Grants the pgTAP Redemption Pro plan');
insert into public.access_codes (id, code, label, institution_id) values
  ('e1000000-0000-0000-0000-000000000006', 'PGTAP-GRANTS-INSTITUTION', 'Joins pgTAP Test University', 'c1000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------
-- RLS: access_code_redemptions (cross-user isolation)
-- ---------------------------------------------------------------------

select tests.authenticate_as_service_role();
select redeem_access_code('PGTAP-PLAIN', 'a1000000-0000-0000-0000-000000000001');
select tests.clear_authentication();

select tests.authenticate_as('a1000000-0000-0000-0000-000000000001');
select tests.assert_select_visible(
  'public.access_code_redemptions', 'user_id', 'a1000000-0000-0000-0000-000000000001',
  'owner can select their own access-code redemption'
);
select tests.clear_authentication();

select tests.authenticate_as('a1000000-0000-0000-0000-000000000002');
select tests.assert_select_denied(
  'public.access_code_redemptions', 'user_id', 'a1000000-0000-0000-0000-000000000001',
  'a different user cannot select another user''s access-code redemption'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- RLS: billing_events (cross-user isolation) — populated once the
-- "grants a plan" scenario below runs; asserted afterward.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Constraint: billing_events.stripe_event_id is UNIQUE but nullable —
-- the exact mechanism src/lib/billing/sync.ts's withIdempotency depends
-- on to detect a Stripe webhook redelivery (see migration
-- 0017_billing_events_stripe_event_id.sql's own comment).
-- ---------------------------------------------------------------------

select lives_ok(
  $$insert into public.billing_events (user_id, event_type, stripe_event_id) values ('a1000000-0000-0000-0000-000000000001', 'payment_succeeded', 'evt_pgtap_dup')$$,
  'first insert with a given stripe_event_id succeeds'
);
select throws_ok(
  $$insert into public.billing_events (user_id, event_type, stripe_event_id) values ('a1000000-0000-0000-0000-000000000001', 'payment_succeeded', 'evt_pgtap_dup')$$,
  '23505',
  null,
  'a second insert with the same stripe_event_id violates the unique constraint (a real webhook redelivery)'
);
select lives_ok(
  $$insert into public.billing_events (user_id, event_type, stripe_event_id) values ('a1000000-0000-0000-0000-000000000001', 'payment_succeeded', null),
           ('a1000000-0000-0000-0000-000000000001', 'payment_succeeded', null)$$,
  'two rows with a null stripe_event_id do not conflict with each other (Postgres unique columns allow multiple nulls) — real for non-Stripe-originated billing events like a plan grant from an access code'
);

-- ---------------------------------------------------------------------
-- redeem_access_code(): max_redemptions enforcement
-- ---------------------------------------------------------------------

select isnt(
  redeem_access_code('PGTAP-SINGLE-USE', 'a1000000-0000-0000-0000-000000000002'),
  null,
  'the first redemption of a max_redemptions=1 code succeeds'
);
select is(
  redeem_access_code('PGTAP-SINGLE-USE', 'a1000000-0000-0000-0000-000000000003'),
  null,
  'a second, different user redeeming the now-exhausted code gets null, not an error'
);

-- ---------------------------------------------------------------------
-- redeem_access_code(): one redemption per user, ever — a user who
-- already redeemed a code hitting the unique access_code_redemptions.
-- user_id constraint is a real exception, a structurally different
-- outcome from "the code itself is exhausted" (null) above. The whole
-- function call — including the redemption_count increment that
-- happened just before the failing insert — must roll back atomically.
-- ---------------------------------------------------------------------

select throws_ok(
  $$select redeem_access_code('PGTAP-PLAIN', 'a1000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'a user who already redeemed one code raises a unique-violation redeeming a second, rather than silently succeeding twice'
);
select is(
  (select redemption_count from public.access_codes where id = 'e1000000-0000-0000-0000-000000000001'),
  1,
  'the failed second attempt''s redemption_count increment was rolled back with the rest of that function call — still 1, not 2'
);

-- ---------------------------------------------------------------------
-- redeem_access_code(): expired / inactive codes
-- ---------------------------------------------------------------------

select is(
  redeem_access_code('PGTAP-EXPIRED', 'a1000000-0000-0000-0000-000000000003'),
  null,
  'an expired code returns null'
);
select is(
  redeem_access_code('PGTAP-INACTIVE', 'a1000000-0000-0000-0000-000000000003'),
  null,
  'a deactivated (is_active = false) code returns null'
);
select is(
  (select count(*)::int from public.access_code_redemptions where user_id = 'a1000000-0000-0000-0000-000000000003'),
  0,
  'a user who only ever hit an exhausted/expired/inactive code has no redemption row at all — none of those failed attempts left anything behind'
);

-- ---------------------------------------------------------------------
-- redeem_access_code(): granting a plan
-- ---------------------------------------------------------------------

select isnt(
  redeem_access_code('PGTAP-GRANTS-PLAN', 'a1000000-0000-0000-0000-000000000007'),
  null,
  'a plan-granting code redeems successfully'
);
select is(
  (select plan_id from public.subscriptions where user_id = 'a1000000-0000-0000-0000-000000000007'),
  'b1000000-0000-0000-0000-000000000001',
  'the user with no prior subscription is upserted onto the granted plan'
);
select is(
  (select status from public.subscriptions where user_id = 'a1000000-0000-0000-0000-000000000007'),
  'active',
  'the newly granted subscription is active'
);
select is(
  (select count(*)::int from public.billing_events where user_id = 'a1000000-0000-0000-0000-000000000007' and event_type = 'subscription_upgraded'),
  1,
  'the plan grant records a subscription_upgraded billing event'
);

-- A real, already-paying Stripe subscriber must never be overwritten by
-- a promotional access code.
select isnt(
  redeem_access_code('PGTAP-GRANTS-PLAN', 'a1000000-0000-0000-0000-000000000005'),
  null,
  'a plan-granting code still redeems (the redemption itself is recorded) for an already-paying user'
);
select is(
  (select stripe_subscription_id from public.subscriptions where user_id = 'a1000000-0000-0000-0000-000000000005'),
  'sub_pgtap_real_paid_123',
  'an existing active Stripe-backed subscription is never overwritten by an access code''s granted plan'
);

select tests.clear_authentication();

select tests.authenticate_as('a1000000-0000-0000-0000-000000000007');
select tests.assert_select_visible(
  'public.billing_events', 'user_id', 'a1000000-0000-0000-0000-000000000007',
  'owner can select their own billing event (the plan-grant redemption above recorded one)'
);
select tests.clear_authentication();

select tests.authenticate_as('a1000000-0000-0000-0000-000000000001');
select tests.assert_select_denied(
  'public.billing_events', 'user_id', 'a1000000-0000-0000-0000-000000000007',
  'a different user cannot select another user''s billing event'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- redeem_access_code(): granting institution membership
-- ---------------------------------------------------------------------

select tests.authenticate_as_service_role();

select isnt(
  redeem_access_code('PGTAP-GRANTS-INSTITUTION', 'a1000000-0000-0000-0000-000000000004'),
  null,
  'an institution-granting code redeems successfully'
);
select is(
  (select institution_id from public.institution_members where user_id = 'a1000000-0000-0000-0000-000000000004'),
  'c1000000-0000-0000-0000-000000000001',
  'the user is enrolled into the code''s institution'
);

-- A user already in a *different* institution (added directly above,
-- not via redemption) redeeming a code for yet another institution must
-- not be silently moved or duplicated.
select isnt(
  redeem_access_code('PGTAP-GRANTS-INSTITUTION', 'a1000000-0000-0000-0000-000000000006'),
  null,
  'redemption itself still succeeds for a user already belonging to a different institution'
);
select is(
  (select institution_id from public.institution_members where user_id = 'a1000000-0000-0000-0000-000000000006'),
  'c1000000-0000-0000-0000-000000000002',
  'ON CONFLICT DO NOTHING keeps the user in their original institution rather than switching or duplicating membership'
);
select is(
  (select count(*)::int from public.institution_members where user_id = 'a1000000-0000-0000-0000-000000000006'),
  1,
  'exactly one institution_members row exists for that user — no duplicate'
);

select tests.clear_authentication();

select * from finish();
rollback;
