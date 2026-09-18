-- Admin-permission isolation (coarse profiles.role='admin' vs. the
-- fine-grained has_admin_permission() layer on top of it) and
-- service-role-only tables (no anon/authenticated policy of any kind —
-- every access goes through a security-definer function or the
-- service-role client).

begin;

select plan(20);

-- ---------------------------------------------------------------------
-- Fixtures: a plain user, a coarse admin (profiles.role='admin' but no
-- admin_user_roles grant at all), and a super admin actually granted
-- manage_admin_roles/view_audit_logs/view_email_logs.
-- ---------------------------------------------------------------------

select tests.create_user('99111111-1111-1111-1111-111111111111', 'plain-user@test.local');
select tests.create_user('99222222-2222-2222-2222-222222222222', 'coarse-admin@test.local');
select tests.create_user('99333333-3333-3333-3333-333333333333', 'super-admin@test.local');

update public.profiles set role = 'admin' where id in ('99222222-2222-2222-2222-222222222222', '99333333-3333-3333-3333-333333333333');

insert into public.admin_roles (id, slug, name, permissions)
  values ('90000000-0000-0000-0000-000000000001', 'pgtap-test-super-admin', 'pgTAP Test Super Admin', '["manage_admin_roles", "view_audit_logs", "view_email_logs"]'::jsonb);
insert into public.admin_user_roles (user_id, admin_role_id, granted_by)
  values ('99333333-3333-3333-3333-333333333333', '90000000-0000-0000-0000-000000000001', '99333333-3333-3333-3333-333333333333');

insert into public.email_send_logs (recipient, template, status, attempts) values ('someone@test.local', 'test_template', 'sent', 1);

insert into public.access_codes (code, label) values ('PGTAP-TEST-CODE', 'pgTAP fixture');
insert into public.ai_rate_limit_windows (user_id, operation, window_start, request_count) values ('99111111-1111-1111-1111-111111111111', 'test_operation', now(), 1);
insert into public.anonymous_rate_limits (scope, key_value, window_start, request_count) values ('pgtap_test_scope', 'pgtap-test-key', now(), 1);
insert into public.quick_scan_results (token_hash, overall_score, summary, expires_at) values (repeat('d', 64), 80, 'Summary.', now() + interval '90 days');

select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- admin_roles — select gated on coarse profiles.role='admin'; write
-- gated on the finer has_admin_permission('manage_admin_roles').
-- ---------------------------------------------------------------------

select tests.authenticate_as('99111111-1111-1111-1111-111111111111');
select tests.assert_select_denied('public.admin_roles', 'id', '90000000-0000-0000-0000-000000000001', 'a plain (non-admin) user cannot view admin role definitions');
select tests.clear_authentication();

select tests.authenticate_as('99222222-2222-2222-2222-222222222222');
select tests.assert_select_visible('public.admin_roles', 'id', '90000000-0000-0000-0000-000000000001', 'any coarse admin can view admin role definitions (read is role-gated, not permission-gated, by design)');
select tests.assert_update_denied('public.admin_roles', 'id', '90000000-0000-0000-0000-000000000001', 'description = ''Hijacked''', 'a coarse admin without manage_admin_roles cannot edit an admin role');
select tests.clear_authentication();

select tests.authenticate_as('99333333-3333-3333-3333-333333333333');
update public.admin_roles set description = 'Updated by super admin' where id = '90000000-0000-0000-0000-000000000001';
select is(
  (select description from public.admin_roles where id = '90000000-0000-0000-0000-000000000001'),
  'Updated by super admin',
  'an admin WITH manage_admin_roles CAN edit an admin role (positive control)'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- admin_user_roles
-- ---------------------------------------------------------------------

select tests.authenticate_as('99111111-1111-1111-1111-111111111111');
select tests.assert_select_denied('public.admin_user_roles', 'user_id', '99333333-3333-3333-3333-333333333333', 'a plain (non-admin) user cannot view admin role assignments');
select tests.clear_authentication();

select tests.authenticate_as('99222222-2222-2222-2222-222222222222');
select tests.assert_select_visible('public.admin_user_roles', 'user_id', '99333333-3333-3333-3333-333333333333', 'any coarse admin can view admin role assignments (read is role-gated, not permission-gated)');
select tests.assert_delete_denied('public.admin_user_roles', 'user_id', '99333333-3333-3333-3333-333333333333', 'a coarse admin without manage_admin_roles cannot revoke another admin''s role assignment');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- admin_audit_logs — append-only; select gated on view_audit_logs
-- specifically (a coarse admin without that permission is denied —
-- unlike admin_roles/admin_user_roles above, which are coarse-role-
-- gated for reads).
-- ---------------------------------------------------------------------

select tests.authenticate_as('99333333-3333-3333-3333-333333333333');
insert into public.admin_audit_logs (actor_id, actor_email, action, entity_type, entity_id)
  values ('99333333-3333-3333-3333-333333333333', 'super-admin@test.local', 'test.action', 'user', '99111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.admin_audit_logs', 'actor_id', '99333333-3333-3333-3333-333333333333', 'an admin WITH view_audit_logs can view the audit trail');
select tests.clear_authentication();

select tests.authenticate_as('99222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.admin_audit_logs', 'actor_id', '99333333-3333-3333-3333-333333333333', 'a coarse admin WITHOUT view_audit_logs cannot view the audit trail');
select tests.clear_authentication();

select tests.authenticate_as('99111111-1111-1111-1111-111111111111');
select tests.assert_select_denied('public.admin_audit_logs', 'actor_id', '99333333-3333-3333-3333-333333333333', 'a plain (non-admin) user cannot view the audit trail');
select throws_ok(
  $$insert into public.admin_audit_logs (actor_id, actor_email, action, entity_type) values ('99333333-3333-3333-3333-333333333333', 'super-admin@test.local', 'fake.impersonation', 'user')$$,
  '42501',
  'a plain user cannot insert an audit log entry impersonating a different actor'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- email_send_logs — select gated on view_email_logs.
-- ---------------------------------------------------------------------

select tests.authenticate_as('99111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.email_send_logs where recipient = 'someone@test.local'),
  0,
  'a plain (non-admin) user cannot view email send logs'
);
select tests.clear_authentication();

select tests.authenticate_as('99222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.email_send_logs where recipient = 'someone@test.local'),
  0,
  'a coarse admin WITHOUT view_email_logs cannot view email send logs'
);
select tests.clear_authentication();

select tests.authenticate_as('99333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.email_send_logs where recipient = 'someone@test.local'),
  1,
  'an admin WITH view_email_logs can view email send logs'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- Service-role-only tables — no anon/authenticated policy at all;
-- every real access goes through a security-definer RPC or the
-- service-role client. One `anon` and one `authenticated` role checked
-- per table across this group for coverage of both untrusted profiles.
-- ---------------------------------------------------------------------

select tests.authenticate_as_anon();
select is(
  (select count(*)::int from public.access_codes where code = 'PGTAP-TEST-CODE'),
  0,
  'an anonymous request cannot read access_codes'
);
select throws_ok(
  $$insert into public.access_codes (code, label) values ('ANON-INJECTED', 'should never work')$$,
  '42501',
  'an anonymous request cannot insert into access_codes'
);
select is(
  (select count(*)::int from public.quick_scan_results where token_hash = repeat('d', 64)),
  0,
  'an anonymous request cannot read quick_scan_results directly (token-hash lookup only, via service role)'
);
select tests.clear_authentication();

select tests.authenticate_as('99111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.ai_rate_limit_windows where operation = 'test_operation'),
  0,
  'an authenticated user cannot read ai_rate_limit_windows'
);
select is(
  (select count(*)::int from public.anonymous_rate_limits where scope = 'pgtap_test_scope'),
  0,
  'an authenticated user cannot read anonymous_rate_limits'
);
select tests.clear_authentication();

-- Positive control: service_role (the one real caller of these tables,
-- via the app's service-role admin client) CAN actually read them —
-- confirms every denial above is a real RLS block, not a broken
-- fixture that would show 0 rows for anyone regardless of role.
select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.access_codes where code = 'PGTAP-TEST-CODE'),
  1,
  'service_role CAN read access_codes (positive control)'
);
select tests.clear_authentication();

select * from finish();
rollback;
