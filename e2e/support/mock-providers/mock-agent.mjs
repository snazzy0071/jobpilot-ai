// Real E2E-boundary provider mocks — intercepts the exact outbound HTTP
// calls this app makes to Anthropic, Stripe, and Resend, at the actual
// network transport layer (undici's global dispatcher, which is what
// Node's built-in `fetch` is backed by), so `src/lib/ai/service.ts`,
// `src/lib/stripe/client.ts`, and `src/lib/email/resend.ts` run their
// real, unmodified code end to end — only the literal network I/O is
// swapped out. Nothing in `src/` imports this file or knows it exists;
// it's loaded as a Node process preload *before* the Next.js server
// boots (see e2e/support/mock-providers/preload.mjs), the same way a
// real deployment would never load it.
//
// Deliberately does NOT call `mockAgent.disableNetConnect()` — that
// would block *every* unmocked origin, including the real Supabase
// project these tests still need for everything except AI/Stripe/email.
// undici's own default (confirmed by reading mock-agent.js directly:
// `this[kNetConnect] = true` in the constructor) already does exactly
// what's wanted here: intercept only the origins registered below,
// pass everything else straight through to the real network.

import { MockAgent, setGlobalDispatcher } from "undici";
import { generateFromJsonSchema } from "./json-schema-fixture.mjs";

const mockAgent = new MockAgent();
setGlobalDispatcher(mockAgent);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Every reply below returns this shape — a real JSON body with a real content-type header, the two things every one of these SDKs needs to parse the response as success. */
function json(statusCode, data) {
  return { statusCode, data: JSON.stringify(data), responseOptions: { headers: { "content-type": "application/json" } } };
}

// ---------------------------------------------------------------------
// Anthropic — POST /v1/messages (src/lib/ai/service.ts's generateText
// and generateStructured both call this one endpoint; the only real
// difference between the two request shapes is whether `tools`/
// `tool_choice` are present).
// ---------------------------------------------------------------------

mockAgent
  .get("https://api.anthropic.com")
  .intercept({ path: "/v1/messages", method: "POST" })
  .reply(({ body }) => {
    const request = JSON.parse(typeof body === "string" ? body : "{}");
    const tool = Array.isArray(request.tools) ? request.tools[0] : null;

    const content = tool
      ? [{ type: "tool_use", id: "toolu_mock", name: tool.name, input: generateFromJsonSchema(tool.input_schema) }]
      : [{ type: "text", text: "This is a mocked E2E response — no real Anthropic call was made." }];

    return json(200, {
      id: "msg_mock_e2e",
      type: "message",
      role: "assistant",
      model: request.model ?? "claude-sonnet-5",
      content,
      stop_reason: tool ? "tool_use" : "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  })
  .persist();

// ---------------------------------------------------------------------
// Stripe — src/lib/stripe/client.ts only puts Stripe on a fetch-based
// HTTP client (so this interceptor can even see the request at all —
// its real default uses Node's raw `https` module, invisible to
// undici's dispatcher) when E2E_MOCK_PROVIDERS is set. Requests are
// form-urlencoded, not JSON — bodies aren't parsed here since the app
// itself only ever reads back `customer.id`/`session.url`, never
// echoes the request back for validation.
// ---------------------------------------------------------------------

const stripe = mockAgent.get("https://api.stripe.com");

stripe
  .intercept({ path: "/v1/customers", method: "POST" })
  .reply(() => json(200, { id: `cus_mock_${Date.now()}`, object: "customer" }))
  .persist();

stripe
  .intercept({ path: "/v1/checkout/sessions", method: "POST" })
  .reply(() =>
    json(200, {
      id: `cs_mock_${Date.now()}`,
      object: "checkout.session",
      // Points straight at this app's own real post-checkout success
      // URL rather than attempting to simulate Stripe's own hosted
      // checkout UI, which is Stripe's product surface, not this app's
      // — the E2E value here is verifying what *this app* does once
      // Stripe reports success, not re-testing Stripe's own pages.
      url: `${siteUrl}/dashboard/settings?checkout=success`,
    }),
  )
  .persist();

stripe
  .intercept({ path: "/v1/billing_portal/sessions", method: "POST" })
  .reply(() =>
    json(200, {
      id: `bps_mock_${Date.now()}`,
      object: "billing_portal.session",
      url: `${siteUrl}/dashboard/settings?tab=billing`,
    }),
  )
  .persist();

// ---------------------------------------------------------------------
// Resend — POST /emails (src/lib/email/resend.ts's sendEmail, the one
// place this whole app sends real mail).
// ---------------------------------------------------------------------

mockAgent
  .get("https://api.resend.com")
  .intercept({ path: "/emails", method: "POST" })
  .reply(() => json(200, { id: `email_mock_${Date.now()}` }))
  .persist();

console.log("[e2e] Provider mocks installed: api.anthropic.com, api.stripe.com, api.resend.com");
