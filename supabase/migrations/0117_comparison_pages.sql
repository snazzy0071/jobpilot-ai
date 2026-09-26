-- Dynamic comparison pages (/compare/[slug]): "JobPilot AI vs <competitor>", one row per competitor.
--
-- The content is deliberately claims-with-evidence: every statement about a competitor (a feature, a price, a difference) carries
-- the public page it came from and the date it was checked, and the page as a whole carries an "information checked on" date.
-- That is validated when an admin saves (src/lib/comparisons/schemas.ts); the table only guarantees the shape. Nothing is seeded:
-- competitor facts must be entered from the competitor's own published pages, never written from memory.

create table public.comparison_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  competitor_name text not null check (char_length(competitor_name) between 1 and 100),
  competitor_website text check (competitor_website is null or (char_length(competitor_website) <= 500 and competitor_website ~* '^https?://')),
  -- A short, neutral lead-in in our own words (what the competitor is, what the comparison covers).
  intro text check (intro is null or char_length(intro) <= 1500),
  -- Each is an array of items; the item shapes (and that every competitor claim has a source URL and date) are enforced in the app.
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array' and jsonb_array_length(features) <= 40),
  pricing jsonb not null default '[]'::jsonb check (jsonb_typeof(pricing) = 'array' and jsonb_array_length(pricing) <= 12),
  differences jsonb not null default '[]'::jsonb check (jsonb_typeof(differences) = 'array' and jsonb_array_length(differences) <= 12),
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 20),
  -- The date the competitor information was last checked against its sources (shown to readers).
  updated_on date not null,
  -- Null = draft; a future time = scheduled.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comparison_pages_published_idx on public.comparison_pages (published_at desc);

create trigger set_comparison_pages_updated_at
  before update on public.comparison_pages
  for each row execute procedure public.set_updated_at();

alter table public.comparison_pages enable row level security;

create policy "Anyone can view live comparison pages"
  on public.comparison_pages for select
  using (
    (published_at is not null and published_at <= now())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can insert comparison pages"
  on public.comparison_pages for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update comparison pages"
  on public.comparison_pages for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete comparison pages"
  on public.comparison_pages for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

update public.admin_roles
set permissions = permissions || '["manage_comparisons"]'::jsonb
where slug = 'super_admin' and not (permissions ? 'manage_comparisons');
