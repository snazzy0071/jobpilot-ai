-- Double opt-in for the newsletter. Until now anyone could subscribe any address (there is no proof the owner agreed). A new signup is
-- now `pending` and only becomes `subscribed` when the address's owner opens the link in the confirmation email. Only the SHA-256 hash
-- of the confirmation token is stored, and it expires (checked against confirmation_sent_at by the confirm action).
-- Existing `subscribed` rows are left as they are: nothing is sent to the list yet, and any send must go only to confirmed rows
-- (`confirmed_at is not null`) or to rows that predate this migration.

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_status_check;

alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_status_check check (status in ('pending', 'subscribed', 'unsubscribed')),
  add column confirm_token_hash text,
  add column confirmation_sent_at timestamptz,
  add column confirmed_at timestamptz;

create unique index newsletter_subscribers_confirm_token_hash_idx
  on public.newsletter_subscribers (confirm_token_hash)
  where confirm_token_hash is not null;

comment on column public.newsletter_subscribers.confirm_token_hash is
  'SHA-256 of the one-time confirmation token emailed to the address. Cleared once confirmed. Never the raw token.';
comment on column public.newsletter_subscribers.confirmed_at is
  'When the address owner confirmed by opening the emailed link. Null for rows that predate double opt-in.';
