-- Correction to the comment added in 0127: the confirmation token hash is kept after the address is confirmed, so the emailed link is
-- idempotent (a second click, or an email client that pre-fetches links, still shows "already subscribed").
comment on column public.newsletter_subscribers.confirm_token_hash is
  'SHA-256 of the one-time confirmation token emailed to the address. Kept after confirming so the link stays idempotent. Never the raw token.';
