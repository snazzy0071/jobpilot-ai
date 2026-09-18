-- Adds a consent audit trail, an unsubscribe capability, and suppression
-- state to public newsletter signups. Previously a bare email + insert
-- timestamp with no record of *where* consent came from, no way to honor
-- an unsubscribe without deleting the row (losing the fact that consent
-- was once given and later revoked), and a plain unique-insert that
-- silently no-opped a resubscribe attempt behind the unique constraint
-- instead of actually reactivating it.

alter table public.newsletter_subscribers
  add column consent_source text not null default 'newsletter_page'
    check (consent_source in ('newsletter_page', 'quick_scan')),
  add column status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed')),
  add column unsubscribed_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid() unique;

comment on column public.newsletter_subscribers.subscribed_at is
  'Consent timestamp — refreshed on every (re)subscribe via upsert, not just the first insert.';
comment on column public.newsletter_subscribers.consent_source is
  'Which surface consent was captured on — the dedicated /newsletter page, or the separate marketing-consent checkbox on the free ATS checker.';
comment on column public.newsletter_subscribers.unsubscribe_token is
  'Unguessable capability used by the public unsubscribe link — never the row id, which is already exposed to admin tooling.';
