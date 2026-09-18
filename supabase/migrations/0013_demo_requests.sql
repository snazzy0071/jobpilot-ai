-- Backs the /demo institution demo-request form. Same insert-only RLS
-- pattern as contact_messages/newsletter_subscribers: anyone can submit,
-- nobody but the service role can read it back.

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null check (char_length(institution_name) between 1 and 200),
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text check (role is null or char_length(role) <= 200),
  student_population text check (student_population is null or char_length(student_population) <= 100),
  message text check (message is null or char_length(message) <= 5000),
  created_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;

create policy "Anyone can request a demo"
  on public.demo_requests for insert
  to anon, authenticated
  with check (true);
