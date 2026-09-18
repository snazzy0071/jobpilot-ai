-- Backs the /partners inquiry form. Same insert-only RLS pattern as the
-- other lead-capture tables.

create table public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  organisation_name text not null check (char_length(organisation_name) between 1 and 200),
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  partnership_type text not null check (
    partnership_type in (
      'University careers service',
      'Student society or ambassador programme',
      'Employer partner',
      'Bootcamp or accelerator',
      'Other'
    )
  ),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.partner_inquiries enable row level security;

create policy "Anyone can submit a partner inquiry"
  on public.partner_inquiries for insert
  to anon, authenticated
  with check (true);
