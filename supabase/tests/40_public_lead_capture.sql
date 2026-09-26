-- Public lead-capture tables (newsletter, contact, demo, partner inquiries): since migration 0124 anonymous INSERT is DENIED (the form
-- actions write with the service role after their per-IP rate limit and validation, so the database API cannot be used to skip them),
-- and SELECT stays denied to everyone but admins and the service role.

begin;

select plan(12);

select tests.create_user('88111111-1111-1111-1111-111111111111', 'plain-user@test.local');
select tests.clear_authentication();

select tests.authenticate_as_anon();

select throws_ok(
  $$insert into public.contact_messages (name, email, subject, message) values ('Test Name', 'test@test.local', 'Subject', 'Message body.')$$,
  '42501',
  'anon can NOT insert into contact_messages directly (migration 0124: the form actions write with the service role after their rate limit)'
);
select is((select count(*)::int from public.contact_messages where email = 'test@test.local'), 0, 'anon cannot read contact_messages back');

select throws_ok(
  $$insert into public.demo_requests (institution_name, contact_name, email) values ('Test Institution', 'Test Contact', 'demo@test.local')$$,
  '42501',
  'anon can NOT insert into demo_requests directly (migration 0124: the form actions write with the service role after their rate limit)'
);
select is((select count(*)::int from public.demo_requests where email = 'demo@test.local'), 0, 'anon cannot read demo_requests back');

select throws_ok(
  $$insert into public.partner_inquiries (organisation_name, contact_name, email, partnership_type, message) values ('Test Org', 'Test Contact', 'partner@test.local', 'Other', 'Inquiry message.')$$,
  '42501',
  'anon can NOT insert into partner_inquiries directly (migration 0124: the form actions write with the service role after their rate limit)'
);
select is((select count(*)::int from public.partner_inquiries where email = 'partner@test.local'), 0, 'anon cannot read partner_inquiries back');

select throws_ok(
  $$insert into public.newsletter_subscribers (email, consent_source) values ('newsletter@test.local', 'newsletter_page')$$,
  '42501',
  'anon can NOT insert into newsletter_subscribers directly (migration 0124: the form actions write with the service role after their rate limit)'
);
select is((select count(*)::int from public.newsletter_subscribers where email = 'newsletter@test.local'), 0, 'anon cannot read newsletter_subscribers back');

select tests.clear_authentication();

-- An ordinary authenticated account (not an admin) is no more trusted
-- than anon here — these four tables have no select policy for anyone
-- but service_role, full stop.
select tests.authenticate_as('88111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.contact_messages where email = 'test@test.local'), 0, 'an authenticated (non-admin) user cannot read contact_messages either');
select is((select count(*)::int from public.demo_requests where email = 'demo@test.local'), 0, 'an authenticated (non-admin) user cannot read demo_requests either');
select is((select count(*)::int from public.partner_inquiries where email = 'partner@test.local'), 0, 'an authenticated (non-admin) user cannot read partner_inquiries either');
select is((select count(*)::int from public.newsletter_subscribers where email = 'newsletter@test.local'), 0, 'an authenticated (non-admin) user cannot read newsletter_subscribers either');
select tests.clear_authentication();

select * from finish();
rollback;
