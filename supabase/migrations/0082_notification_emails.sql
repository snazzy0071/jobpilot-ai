-- Adds the dedup flag the welcome email needs. It's fired from two
-- different auth routes (password-confirm and OAuth callback), so
-- dedup has to key off a persisted flag rather than "first time this
-- route fires" — a retried callback or a reused confirmation link must
-- both be safe no-ops.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;
