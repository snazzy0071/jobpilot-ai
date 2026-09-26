-- Advice Hub: evergreen guides in eight fixed categories, separate from the Blog (its own tables, routes and admin). It reuses the
-- Blog's *content infrastructure* rather than its data: the same typed content blocks (paragraph / heading / list / quote —
-- src/lib/content/blocks.ts), which is what lets a table of contents be built from the headings and keeps the renderer free of
-- raw HTML.

create table public.advice_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 500),
  -- Fixed set (mirrored in src/lib/advice/categories.ts), so the hub's filters and the admin form can't drift from the data.
  category text not null check (category in ('cv', 'ats', 'interviews', 'applications', 'graduate_schemes', 'visa_sponsorship', 'assessments', 'career_advice')),
  content jsonb not null check (jsonb_typeof(content) = 'array' and jsonb_array_length(content) > 0),
  -- Shown on the hub's "Featured guides" row, in this order (lowest first) — null means not featured.
  featured_rank integer check (featured_rank is null or featured_rank between 1 and 100),
  -- Hand-picked "related guides" (slugs); anything not listed is topped up automatically from the same category.
  related_slugs text[] not null default '{}' check (cardinality(related_slugs) <= 6),
  author_name text check (author_name is null or char_length(author_name) between 1 and 100),
  -- The date someone last checked the advice still holds — shown to readers, so old guides are visibly old.
  reviewed_on date,
  -- Null = draft. A future date = scheduled (not visible until then).
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advice_guides_category_idx on public.advice_guides (category);
create index advice_guides_published_idx on public.advice_guides (published_at desc);
create index advice_guides_featured_idx on public.advice_guides (featured_rank) where featured_rank is not null;

create trigger set_advice_guides_updated_at
  before update on public.advice_guides
  for each row execute procedure public.set_updated_at();

alter table public.advice_guides enable row level security;

-- Anyone reads published guides; admins (the same check graduate_schemes uses) also see drafts and scheduled ones.
create policy "Anyone can view published advice guides"
  on public.advice_guides for select
  using (
    (published_at is not null and published_at <= now())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can insert advice guides"
  on public.advice_guides for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update advice guides"
  on public.advice_guides for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete advice guides"
  on public.advice_guides for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Its own admin permission (src/lib/admin/permission-types.ts), granted to super_admin like every earlier expansion.
update public.admin_roles
set permissions = permissions || '["manage_advice_hub"]'::jsonb
where slug = 'super_admin' and not (permissions ? 'manage_advice_hub');
