-- Backs the public /newsletter signup form. Anonymous by design — this is
-- separate from `profiles.newsletter_consent` (an existing account opting
-- in during signup); this table is for visitors with no account at all.
--
-- Insert is open to anon/authenticated because that's the entire point of
-- a public signup form — RLS still blocks select/update/delete for
-- everyone but the service role, so submitted emails can't be read back
-- or enumerated by other visitors.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subscribed_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (true);
