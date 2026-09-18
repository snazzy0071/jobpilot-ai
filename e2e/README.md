# End-to-end tests (Playwright)

Real, full-stack tests that drive a real browser against a running instance of
this app and a real Supabase project — a different layer entirely from
`src/**/*.test.ts` (Vitest, every I/O boundary mocked) and
`supabase/tests/*.sql` (pgTAP, real Postgres but no app/browser layer).

## What this needs to actually run

1. A real Supabase project, reachable from wherever the suite runs, with
   this app's full migration set applied. `.env.local` (or the environment
   the test process inherits) needs:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — used only by `e2e/support/*` to create
     and delete isolated test accounts directly via the admin API, never
     by the app itself in these tests.
2. A running instance of the app at `E2E_BASE_URL` (defaults to
   `http://localhost:3000`, and `playwright.config.ts` will start
   `npm run dev` itself if `E2E_BASE_URL` isn't set).
3. For the ATS-scan spec's happy-path test specifically, run in the
   default mode (below): a real `ANTHROPIC_API_KEY` configured on the
   server the suite is hitting. Without one, `runAtsScan` fails closed
   with "AI features aren't available right now" — a real, correct
   behavior in its own right, just not the successful-scan path that one
   test exercises. Every other spec needs no AI/email/Stripe keys at all.

Run with:

```
npm run test:e2e
```

## Mocked-provider mode

```
npm run test:e2e:mocked
```

Same suite, same real Supabase project — but every outbound call this
app makes to Anthropic, Stripe, and Resend is intercepted at the network
layer (`e2e/support/mock-providers/`, loaded as a Node process preload
*before* Next.js boots) and answered with realistic canned responses
instead of reaching the real providers. Nothing in `src/` imports or
knows about this — the one production-code change it needs is a single
guarded branch in `src/lib/stripe/client.ts` that only ever activates
under `E2E_MOCK_PROVIDERS=1`, which the app itself never sets.

This is what makes the ATS-scan spec's real-AI test pass without a real
`ANTHROPIC_API_KEY`, and is the right mode for any run where hitting real
paid APIs isn't wanted (most CI runs, most local iteration) — the
default (unmocked) mode above is for deliberately verifying against the
real providers themselves.

The Anthropic mock is schema-driven, not hand-fixtured per prompt: it
walks whatever JSON Schema a `generateStructured` call sends (`z.
toJSONSchema` on the real zod schema) and fabricates a plausible,
schema-valid value — so it stays correct as prompts change, and covers
every structured AI call in the app (ATS scan, job match, interview
scoring, ...) with one interceptor rather than one per feature. Verified
directly (a disposable script, run and deleted) against both a plain-text
call and a structured tool-call shape before being trusted — see
`docs/BUILD_CHECKLIST.md`'s own write-up for what that confirmed.

## Isolated test data

Every spec creates its own real, uniquely-identified account
(`e2e+<timestamp>-<random>@e2e.jobpilotai.test`, see
`e2e/support/test-user.ts`) via the Supabase admin API — pre-confirmed
(`email_confirm: true`), bypassing the real email-confirmation step on
purpose (there's no inbox for this suite to check, and every spec except
`auth/signup.spec.ts` is testing what happens *after* a real account
exists, not signup's own confirmation email). Deleting the account
(`e2e/fixtures.ts`'s `testUser` fixture, always run in a test's teardown)
cascades to everything it owns — CVs, applications, subscriptions, everything
— because every one of those tables' foreign keys to `auth.users` is
`on delete cascade`, the same fact `supabase/tests/00_helpers.sql`'s own
fixtures already rely on. No shared/seeded accounts, no fixture data left
behind between runs, and no test's data can collide with another's or with
whatever else happens to be in that Supabase project.

The one exception is `auth/signup.spec.ts`, which drives the *real* signup
form (the one flow that has to go through actual email confirmation to be
meaningful) — it generates its own unique email and cleans up by looking
the account up afterward, since it never gets an id back from a UI-only flow.

## Status

**Written, not executed against a real target in the environment this was
authored in.** Every selector (`getByLabel`/`getByRole`/route/redirect
target/validation message) was checked against the real, current source —
not guessed — including two real mistakes this caught and fixed along the
way: the onboarding step order is actually about → targets → logistics
(not the folder-listing order about → logistics → targets), and the
graduation-year validation error text is "Enter a valid year", not
anything containing the words "graduation year". Still: this suite has
never actually run, so treat first execution as the real verification
pass, not a formality.
