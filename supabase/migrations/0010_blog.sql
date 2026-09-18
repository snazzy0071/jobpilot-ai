-- Blog: categories, authors, and posts. Content is stored as an ordered
-- jsonb array of typed blocks (paragraph/heading/list/quote) rather than
-- raw HTML or markdown, so the article renderer never needs
-- dangerouslySetInnerHTML and the table of contents can be built directly
-- from heading blocks (each carries its own anchor id).
--
-- There's no admin CMS yet, so posts are authored and published via
-- migration for now; write access is service-role only, matching
-- access_codes' pattern (no insert/update/delete policy needed since the
-- service role bypasses RLS entirely).

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.blog_categories enable row level security;

create policy "Anyone can view categories"
  on public.blog_categories for select
  using (true);

create table public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.blog_authors enable row level security;

create policy "Anyone can view authors"
  on public.blog_authors for select
  using (true);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  category_id uuid not null references public.blog_categories (id),
  author_id uuid not null references public.blog_authors (id),
  content jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

create index blog_posts_category_id_idx on public.blog_posts (category_id);
create index blog_posts_published_at_idx on public.blog_posts (published_at desc);

-- Unpublished/future-dated posts stay invisible to anon/authenticated
-- readers; service-role tooling (a future admin CMS) bypasses this.
create policy "Anyone can view published posts"
  on public.blog_posts for select
  using (published_at is not null and published_at <= now());

-- Seed authors
insert into public.blog_authors (slug, name, bio) values
  ('priya-nair', 'Priya Nair', 'Writes about CVs, applications, and interview preparation for the UK job market.'),
  ('tom-whitfield', 'Tom Whitfield', 'Writes about UK visa sponsorship and what it actually means for a job search.');

-- Seed categories
insert into public.blog_categories (slug, name) values
  ('cv-resume', 'CV & Resume'),
  ('ats-applications', 'ATS & Applications'),
  ('interviews', 'Interviews'),
  ('visa-sponsorship', 'Visa & Sponsorship');

-- Seed posts
insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'how-to-format-a-cv-for-the-uk-job-market',
  'How to format a CV for the UK job market',
  'UK recruiters read CVs differently to how they''re read elsewhere — here''s what actually matters.',
  (select id from public.blog_categories where slug = 'cv-resume'),
  (select id from public.blog_authors where slug = 'priya-nair'),
  '2026-08-04 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "If you've written a resume for a different market, some of that advice doesn't carry over cleanly. UK recruiters have their own expectations about length, structure, and what belongs on the page at all — and getting them wrong doesn't disqualify you outright, but it does make your CV harder to read quickly, which matters when someone is working through a stack of fifty applications."},
    {"type": "heading", "level": 2, "id": "personal-statement-not-objective", "text": "Start with a personal statement, not an objective"},
    {"type": "paragraph", "text": "A US-style objective statement talks about what you want. A UK personal statement talks about what you offer — three or four sentences summarising your experience, your specialism, and the kind of role you're aiming for. It sits directly under your name and contact details, before anything else."},
    {"type": "heading", "level": 2, "id": "reverse-chronological-still-king", "text": "Reverse-chronological is still king"},
    {"type": "paragraph", "text": "Functional CVs that group skills instead of listing roles in order are a hard sell in the UK — recruiters read them as a way of hiding gaps or a lack of relevant experience, even when that's not the intent. List your roles most-recent-first, with dates, and let the experience speak for itself."},
    {"type": "heading", "level": 2, "id": "how-much-detail-per-role", "text": "How much detail to give each role"},
    {"type": "paragraph", "text": "Not every role deserves equal space. Your most recent one or two positions should carry the most detail — three to five bullet points focused on outcomes, not just duties. Older or less relevant roles can shrink to a single line with the job title, employer, and dates; nobody needs your two-week retail job from a decade ago broken into bullet points."},
    {"type": "heading", "level": 2, "id": "what-to-leave-off-entirely", "text": "What to leave off entirely"},
    {"type": "list", "items": [
      "A photo — including one is unusual outside a small number of industries, and some employers will screen it out to avoid bias claims.",
      "Date of birth and marital status — neither is relevant, and including them reads as dated.",
      "\"References available on request\" — assumed by default; the line adds nothing."
    ]},
    {"type": "paragraph", "text": "None of this is about box-ticking. Every convention here exists because it makes the CV faster to read and evaluate fairly, which is exactly what you want when someone's deciding whether to move you to the next stage."}
  ]$json$::jsonb
);

insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'should-your-cv-really-be-one-page',
  'Should your CV really be one page?',
  'The one-page rule is repeated constantly and followed inconsistently. Here''s when it actually applies.',
  (select id from public.blog_categories where slug = 'cv-resume'),
  (select id from public.blog_authors where slug = 'priya-nair'),
  '2026-09-01 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "It's one of the most repeated pieces of CV advice, and one of the least consistently applied. Search for it and you'll find confident answers on both sides. The honest answer is that it depends on how much relevant experience you actually have — and even then, one page is a guideline, not a hard rule."},
    {"type": "heading", "level": 2, "id": "where-the-rule-comes-from", "text": "Where the one-page rule comes from"},
    {"type": "paragraph", "text": "It's aimed squarely at graduates and early-career candidates, where a second page usually means padding — a module list, a summer job with no relevant detail, or a skills section repeating what's already implied by the degree. For that stage, one page is usually achievable and worth aiming for."},
    {"type": "heading", "level": 2, "id": "when-two-pages-is-right", "text": "When two pages is the right call"},
    {"type": "paragraph", "text": "Once you have several years of relevant experience across more than one role, forcing it onto one page usually means cutting detail that would otherwise help your case — the specific scope of a project, the size of a team you managed, a result worth naming. Two pages is standard and expected for experienced candidates; nobody screens out a well-organised two-page CV for length alone."},
    {"type": "heading", "level": 2, "id": "what-a-recruiter-actually-notices", "text": "What a recruiter actually notices"},
    {"type": "paragraph", "text": "Recruiters scan before they read — most spend under a minute on a first pass. What they notice first isn't the page count, it's whether the top third of the first page makes the case for you quickly. A CV that front-loads its strongest, most relevant points reads as sharp regardless of whether it runs to one page or two; one that saves the best material for page two risks it never being seen at all."},
    {"type": "heading", "level": 2, "id": "the-real-rule", "text": "The real rule: every line has to earn its place"},
    {"type": "paragraph", "text": "Length is really a proxy for a different question: is everything on the page actually useful to the person reading it? A tight two-page CV beats a padded one-page CV every time. Cut what's irrelevant first, and let the length settle wherever that leaves you."}
  ]$json$::jsonb
);

insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'why-good-candidates-get-filtered-out',
  'Why good candidates get filtered out before a human ever sees their CV',
  'Applicant tracking systems don''t reject people for being unqualified nearly as often as people assume — usually it''s something much more fixable.',
  (select id from public.blog_categories where slug = 'ats-applications'),
  (select id from public.blog_authors where slug = 'priya-nair'),
  '2026-08-11 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "\"The ATS rejected me\" gets used as a catch-all explanation for silence after an application, and it's often at least partly right — but not for the reason most people assume. It's rarely about being unqualified. It's usually about the file not saying what the job description is looking for, in the way the system expects to find it."},
    {"type": "heading", "level": 2, "id": "what-an-ats-actually-does", "text": "What an ATS actually does"},
    {"type": "paragraph", "text": "Most applicant tracking systems don't make a hire or reject decision on their own. They parse your CV into structured fields — job titles, dates, skills — and rank or filter candidates against the criteria a recruiter has set for that specific role. A human still makes the actual decision; the ATS decides who they see first, and sometimes, who they see at all."},
    {"type": "heading", "level": 2, "id": "most-common-reasons", "text": "The most common reasons a strong CV gets filtered anyway"},
    {"type": "list", "items": [
      "Keyword mismatch — the job description says \"stakeholder management\" and your CV says \"client relations\". To a person those are the same thing; to a keyword match, they're not.",
      "Non-standard section headings — \"Where I've Been\" instead of \"Experience\" can fail to parse correctly.",
      "Tables, columns, and text boxes — many systems read left-to-right, top-to-bottom, and multi-column layouts get scrambled into the wrong order.",
      "Missing the exact job title — if the posting says \"Data Analyst\" and your most similar role was titled \"Insights Associate\", spell out the overlap explicitly."
    ]},
    {"type": "heading", "level": 2, "id": "check-before-you-apply", "text": "How to check before you apply, not after"},
    {"type": "paragraph", "text": "The frustrating part is that most of this is invisible until after you've already applied and heard nothing back. Running your CV against the actual job description before you submit — checking for the keywords it's missing and whether the formatting will parse cleanly — turns a guessing game into something you can actually fix in advance, rather than a mystery you're left to reverse-engineer from silence."},
    {"type": "heading", "level": 2, "id": "not-keyword-stuffing", "text": "The fix isn't keyword stuffing"},
    {"type": "paragraph", "text": "Pasting the entire job description into white text isn't a real strategy — most modern systems ignore hidden text, and it doesn't help the human reader at all. The actual fix is matching the language honestly: if you've done the thing the job description is asking for, describe it using their words as well as yours, in a clean, single-column, standard-section format."}
  ]$json$::jsonb
);

insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'answering-competency-questions-without-sounding-rehearsed',
  'Answering competency questions without sounding rehearsed',
  'STAR is good advice that people apply badly. Here''s how to use it without sounding like you''re reciting a script.',
  (select id from public.blog_categories where slug = 'interviews'),
  (select id from public.blog_authors where slug = 'priya-nair'),
  '2026-08-18 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "STAR — Situation, Task, Action, Result — is genuinely good advice. It's also the reason so many interview answers sound identical: a long, careful scene-setting, a task, a list of actions, and a result tacked on at the end almost as an afterthought. The structure isn't the problem. The order most people use it in is."},
    {"type": "heading", "level": 2, "id": "why-star-sounds-robotic", "text": "Why STAR answers start to sound robotic"},
    {"type": "paragraph", "text": "When you spend the first thirty seconds on background — the company, the team, the project timeline — before getting to what you actually did, the interviewer has to hold all of that context in mind while waiting for the point. It's harder to follow, not easier, and it reads as rehearsed because it's optimised for completeness rather than clarity."},
    {"type": "heading", "level": 2, "id": "lead-with-result", "text": "Lead with the result, not the setup"},
    {"type": "paragraph", "text": "Try inverting it: start with the outcome in one sentence, then back up to explain how you got there. \"I cut our onboarding time by a third\" is a stronger opening line than three sentences about what the team looked like before you start explaining what you changed. It also means that if you get cut off or the interviewer moves on, the most important part has already landed."},
    {"type": "heading", "level": 2, "id": "keep-the-middle-tight", "text": "Keep the middle tight"},
    {"type": "paragraph", "text": "Once the result is out front, the middle of the answer only needs enough context to make your actions make sense — who was involved, what the constraint was, and the one or two decisions that actually mattered. Anything beyond that is detail the interviewer didn't ask for and will start to tune out. If a follow-up question needs more depth, that's what it's for."},
    {"type": "heading", "level": 2, "id": "practice-structure-not-wording", "text": "Practise the structure, not the wording"},
    {"type": "paragraph", "text": "Memorising an answer word-for-word is what makes it sound rehearsed — you can hear it when someone's reciting rather than remembering. Practise the shape of the story instead: the result, the one or two decisions that mattered, and a specific number or detail that makes it concrete. The wording can change every time you tell it; the structure is what keeps it sharp."}
  ]$json$::jsonb
);

insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'what-a-uk-sponsor-licence-actually-means',
  'What a UK sponsor licence actually means for your job search',
  'Holding a licence and sponsoring you for a specific role are two different things. Here''s what to actually check.',
  (select id from public.blog_categories where slug = 'visa-sponsorship'),
  (select id from public.blog_authors where slug = 'tom-whitfield'),
  '2026-08-25 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "\"They're a licensed sponsor\" is where a lot of job search relief gets pinned, and it's an important thing to check — but it answers a narrower question than people think it does. A licence is permission to sponsor. It isn't a guarantee that the specific role you're applying for will be."},
    {"type": "heading", "level": 2, "id": "permission-not-a-promise", "text": "A licence is permission, not a promise"},
    {"type": "paragraph", "text": "A company can hold a sponsor licence and still choose not to sponsor a given vacancy — because the salary doesn't clear the threshold for that route, because the role doesn't meet the skill level required, or simply because they've decided not to for that hire. The licence tells you sponsorship is possible with that employer. It doesn't tell you it's happening for this job."},
    {"type": "heading", "level": 2, "id": "what-to-check-before-applying", "text": "What to check before you apply"},
    {"type": "list", "items": [
      "Whether the licence covers the visa route relevant to your situation — not all licences cover every route.",
      "Whether the role's salary and skill level are likely to meet that route's requirements.",
      "Whether the job advert itself mentions sponsorship — many now say so explicitly, in either direction."
    ]},
    {"type": "heading", "level": 2, "id": "where-to-check", "text": "Where to check"},
    {"type": "paragraph", "text": "The UK Home Office publishes the full register of licensed sponsors, which is the authoritative source — our own Visa Sponsors search pulls from the same register. Either way, treat a licence as step one of the check, not the whole answer, and confirm sponsorship for the specific role directly with the employer once you're in the process."},
    {"type": "heading", "level": 2, "id": "what-happens-once-sponsored", "text": "What happens once you're sponsored"},
    {"type": "paragraph", "text": "Being sponsored ties your right to work to that specific employer and role — it isn't a general work permit you carry between jobs. If you change employer, a new sponsor generally needs to take on that sponsorship before you start. That's worth knowing early, since it shapes how much weight to put on job security versus salary when you're comparing offers."},
    {"type": "paragraph", "text": "This isn't immigration advice — for anything route-specific to your circumstances, that's worth getting from a qualified adviser."}
  ]$json$::jsonb
);

insert into public.blog_posts (slug, title, excerpt, category_id, author_id, published_at, content)
values (
  'graduate-visa-vs-skilled-worker-visa',
  'Graduate visa vs Skilled Worker visa: what''s the difference',
  'They solve different problems, and mixing them up can cost you months of planning.',
  (select id from public.blog_categories where slug = 'visa-sponsorship'),
  (select id from public.blog_authors where slug = 'tom-whitfield'),
  '2026-09-03 09:00:00+00',
  $json$[
    {"type": "paragraph", "text": "These two come up in the same conversations so often that it's easy to assume they're two versions of the same thing. They're not — they solve different problems, and the planning for each looks completely different."},
    {"type": "heading", "level": 2, "id": "graduate-visa-time-not-sponsorship", "text": "The Graduate visa: time, not sponsorship"},
    {"type": "paragraph", "text": "The Graduate route gives eligible international graduates permission to live and work in the UK for a fixed period after finishing their course, without needing a job offer or a sponsor at all. It buys time to job search on equal footing with any other applicant — it doesn't extend indefinitely, and it doesn't convert automatically into anything else when it ends."},
    {"type": "heading", "level": 2, "id": "skilled-worker-sponsorship-not-time", "text": "The Skilled Worker visa: sponsorship, not time"},
    {"type": "paragraph", "text": "The Skilled Worker route is the other direction entirely: it requires a specific job offer from a licensed sponsor, at a role and salary that meet the route's requirements, before it can be granted. There's no browsing period built in — the sponsorship has to be in place first."},
    {"type": "heading", "level": 2, "id": "why-most-people-need-to-think-about-both", "text": "Why most people need to think about both"},
    {"type": "paragraph", "text": "For most international graduates, the practical plan is to use Graduate visa time to find an employer willing to sponsor a Skilled Worker visa before that window closes — which means the sponsor search isn't something to leave until month eleven. Knowing which licensed employers are realistic targets early gives that transition far more runway."},
    {"type": "heading", "level": 2, "id": "what-to-do-with-the-time", "text": "What to do with the time you have"},
    {"type": "paragraph", "text": "The Graduate visa's fixed window is easiest to use well if you treat sponsorship as a search criterion from day one, not a filter you apply once you already like a role. Checking whether an employer is a licensed sponsor before you invest time in an application saves you from building a case for a job that was never going to be able to take you on."},
    {"type": "paragraph", "text": "This isn't immigration advice — requirements and thresholds change, so confirm current detail on gov.uk or with a qualified adviser before relying on it."}
  ]$json$::jsonb
);
