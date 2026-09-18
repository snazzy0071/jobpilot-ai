-- Public lead-capture tables (newsletter, contact, demo, partner
-- inquiries): anonymous INSERT must work (that's the entire point of a
-- public form) while SELECT stays denied to everyone but the
-- service-role client — "anyone can submit, nobody but future admin
-- tooling can read submissions back" per each table's own migration
-- comment (0011-0014).

begin;

select plan(12);

select tests.create_user('88111111-1111-1111-1111-111111111111', 'plain-user@test.local');
select tests.clear_authentication();

select tests.authenticate_as_anon();

select lives_ok(
  $$insert into public.contact_messages (name, email, subject, message) values ('Test Name', 'test@test.local', 'Subject', 'Message body.')$$,
  'anon CAN insert into contact_messages (public lead-capture form)'
);
select is((select count(*)::int from public.contact_messages where email = 'test@test.local'), 0, 'anon cannot read contact_messages back');

select lives_ok(
  $$insert into public.demo_requests (institution_name, contact_name, email) values ('Test Institution', 'Test Contact', 'demo@test.local')$$,
  'anon CAN insert into demo_requests (public lead-capture form)'
);
select is((select count(*)::int from public.demo_requests where email = 'demo@test.local'), 0, 'anon cannot read demo_requests back');

select lives_ok(
  $$insert into public.partner_inquiries (organisation_name, contact_name, email, partnership_type, message) values ('Test Org', 'Test Contact', 'partner@test.local', 'Other', 'Inquiry message.')$$,
  'anon CAN insert into partner_inquiries (public lead-capture form)'
);
select is((select count(*)::int from public.partner_inquiries where email = 'partner@test.local'), 0, 'anon cannot read partner_inquiries back');

select lives_ok(
  $$insert into public.newsletter_subscribers (email, consent_source) values ('newsletter@test.local', 'newsletter_page')$$,
  'anon CAN insert into newsletter_subscribers (public lead-capture form)'
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
