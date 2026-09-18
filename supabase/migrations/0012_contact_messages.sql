-- Backs the public /contact form. Same reasoning as newsletter_subscribers:
-- insert is open to anon/authenticated (anyone should be able to send a
-- message without an account), RLS blocks select/update/delete for
-- everyone but the service role, so a submitted message can't be read
-- back by its sender or anyone else — only by future admin tooling using
-- the service-role client.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "Anyone can submit a contact message"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);
