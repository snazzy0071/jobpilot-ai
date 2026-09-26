-- Contact, demo, partner and newsletter forms were protected by a per-IP rate limit, honeypot and validation in their server actions,
-- but the tables ALSO accepted inserts from the anonymous role (`with check (true)`). Anyone holding the public anon key could POST rows
-- straight to the database API and skip every one of those checks: unlimited spam into the admin leads queue and unbounded storage.
-- The server actions now write with the service role after their checks, so the anonymous insert policies are removed. Nothing else
-- read or wrote these tables as anon (admins read them through their own permission-checked policies).

drop policy if exists "Anyone can submit a contact message" on public.contact_messages;
drop policy if exists "Anyone can request a demo" on public.demo_requests;
drop policy if exists "Anyone can submit a partner inquiry" on public.partner_inquiries;
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
