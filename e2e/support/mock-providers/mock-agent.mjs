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

    const input = tool ? generateFromJsonSchema(tool.input_schema) : null;
    // The generic fixture answers every boolean with false. The keyword rewrite's `applied` flag is the model saying
    // "I worked the keyword in truthfully" — true is the answer that lets a suggestion be reviewed and accepted.
    if (input && typeof input === "object" && typeof input.applied === "boolean") input.applied = true;

    // The ATS scan's keyword lists are what the pre-flight panel turns into actionable fixes (add a skill, rework the
    // summary, rework a role). The generic fixture gives one placeholder keyword with an arbitrary section, which
    // exercises none of that — so a scan-shaped response gets realistic keywords, one for each kind of fix.
    if (input && Array.isArray(input.missingKeywords) && Array.isArray(input.matchedKeywords)) {
      input.matchedKeywords = [{ term: "TypeScript", importance: "high" }];
      input.missingKeywords = [
        { term: "GraphQL", importance: "high", suggestedSection: "skills" },
        { term: "Kubernetes operators", importance: "medium", suggestedSection: "summary" },
        { term: "mentoring", importance: "low", suggestedSection: "experience" },
      ];
    }

    // The interview chat turn's `action` field (src/lib/ai/prompts/interview-chat.ts) is the one enum in this whole
    // app whose *value* drives real server-side control flow (follow-up vs. next question vs. concluding the
    // interview) rather than just being a labelled scored fixture. The generic fixture would always return the
    // schema's first enum member ("follow_up"), which would make every mocked interview stall on question 1
    // forever (the server's own MAX_FOLLOW_UPS_PER_QUESTION=2 defence would eventually force it forward, but only
    // after 2 wasted follow-up round trips per question — 3x the real AI call count for no test value). Instead,
    // read the same two signals the real model is given in its own system prompt
    // (interviewChatTurnPrompt.buildSystem's canConclude/mustAdvance conditionals) and decide deterministically:
    // conclude as soon as it's allowed to (fastest path to a real 5-8-question completed session), otherwise
    // alternate — follow up once per question, then advance — so every mocked session still exercises a real
    // follow-up and a real next-question transition without taking dozens of turns.
    // LinkedIn Optimiser (src/lib/ai/prompts/linkedin-*.ts). The generic fixture gives every string the same
    // placeholder, so the recruiter keyword list would be nine copies of one term and the keyword score could never
    // move. These are deterministic, realistic outputs instead: the About and two bullets contain some of the nine
    // terms, the keyword-dense headline contains two more, and the About/bullet *rewrites* each work in terms the
    // original leaves out — so choosing a headline, editing text and accepting a rewrite each visibly re-score.
    if (input && input.headlineVariants && Array.isArray(input.keywordCoverageTerms)) {
      input.headlineVariants = {
        concise: "Product Manager | Roadmapping",
        narrative: "Product manager who turns customer problems into shipped, measurable products",
        keywordDense: "Product Manager | Roadmapping | Stakeholder Management | SQL | Agile",
      };
      input.about = "I am a product manager focused on Roadmapping and Agile delivery for growing UK teams.";
      input.experienceBullets = [
        "Led Agile delivery for a six-person squad across two releases.",
        "Owned the Roadmapping process for two product teams.",
        "Reported weekly to senior leadership.",
      ];
      input.suggestedSkills = ["Roadmapping", "Agile", "SQL"];
      input.notes = ["Add a Featured section with your best product launch."];
      const term = (name, importance, suggestedPlacement) => ({ term: name, importance, suggestedPlacement });
      input.keywordCoverageTerms = [
        term("Roadmapping", "high", "headline"),
        term("Agile", "high", "about"),
        term("Stakeholder Management", "high", "experience"),
        term("SQL", "high", "about"),
        term("Prioritisation", "medium", "about"),
        term("Experimentation", "medium", "experience"),
        term("Product Analytics", "medium", "about"),
        term("OKRs", "low", "experience"),
        term("User Research", "low", "experience"),
      ];
    }
    if (input && typeof input.about === "string" && typeof input.explanation === "string" && !input.headlineVariants) {
      input.about = "Product manager with Agile delivery, SQL, Prioritisation and OKRs experience across UK teams.";
    }
    if (input && typeof input.bullet === "string" && typeof input.explanation === "string") {
      input.bullet = "Ran Experimentation and User Research reviews with senior leadership every week.";
    }

    // Job match (src/lib/ai/prompts/job-match.ts). The generic fixture gives every number the same value, so the four
    // component bars and the headline score couldn't be told apart. The score depends on the job text so two jobs
    // score differently: a job that mentions "Kubernetes" is a strong match, anything else a middling one.
    if (input && typeof input.matchScore === "number" && input.coreSkills && input.seniority) {
      const prompt = Array.isArray(request.messages) ? String(request.messages[0]?.content ?? "") : "";
      // Only the job listing decides this (the seeded CV happens to mention Kubernetes too).
      const strong = /kubernetes/i.test(prompt.split("Candidate's CV:")[0]);
      input.matchScore = strong ? 86 : 64;
      input.coreSkills = { score: strong ? 90 : 70, summary: "TypeScript and platform delivery in the CV line up with the essential skills." };
      input.techFunctionalSkills = { score: strong ? 84 : 58, summary: "Kubernetes and CI/CD experience is evidenced; payments tooling is not." };
      input.domainFit = { score: strong ? 72 : 55, summary: "Platform work in adjacent UK sectors, not this exact domain." };
      input.seniority = { score: strong ? 88 : 75, summary: "Eight years and a team lead role match the seniority asked for." };
      input.reasons = ["Recent senior platform role matches the level advertised."];
      input.gaps = ["No direct evidence of this sector."];
    }

    // Competencies to cycle through for the two schemas that assign one (the opening question, and a chat turn that
    // advances to a fresh question) — the generic fixture would give every single question the schema's first enum
    // member ("leadership"), so a mocked session's competency breakdown would only ever have one entry, and
    // CompetencyRadarChart deliberately falls back to a plain list below 3 distinct competencies (see its own doc
    // comment) — never exercising the actual radar SVG this task needs to verify renders.
    const COMPETENCY_ROTATION = ["leadership", "teamwork", "communication", "problem_solving", "decision_making"];

    if (input && typeof input.message === "string" && typeof input.competency === "string" && !("action" in input)) {
      // The opening turn — no transcript yet, always the rotation's first competency.
      input.competency = COMPETENCY_ROTATION[0];
    }

    if (input && typeof input.action === "string" && ["follow_up", "next_question", "conclude"].includes(input.action)) {
      const system = typeof request.system === "string" ? request.system : "";
      const prompt = Array.isArray(request.messages) ? String(request.messages[0]?.content ?? "") : "";
      const canConclude = system.includes("You may choose to conclude now");
      const mustAdvance = system.includes("already had enough follow-ups");
      const candidateRepliesSoFar = (prompt.match(/\nCandidate:/g) ?? []).length;

      if (canConclude) input.action = "conclude";
      else if (mustAdvance) input.action = "next_question";
      else input.action = candidateRepliesSoFar % 2 === 1 ? "follow_up" : "next_question";

      if (input.action === "next_question") {
        input.competency = COMPETENCY_ROTATION[Math.floor(candidateRepliesSoFar / 2) % COMPETENCY_ROTATION.length];
      }
    }

    const content = tool
      ? [{ type: "tool_use", id: "toolu_mock", name: tool.name, input }]
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

// Every Stripe request the app makes is appended to E2E_STRIPE_LOG (one JSON object per line: method, path and the form fields it sent),
// so a spec can assert exactly what the app asked Stripe for: which price, which customer, which metadata. Unset = no logging.
import { appendFileSync } from "node:fs";
function record(method, path, body) {
  const file = process.env.E2E_STRIPE_LOG;
  if (!file) return;
  const fields = {};
  const text = typeof body === "string" ? body : body ? String(body) : "";
  for (const [key, value] of new URLSearchParams(text)) fields[key] = value;
  appendFileSync(file, JSON.stringify({ method, path, fields }) + "\n");
}

stripe
  .intercept({ path: "/v1/customers", method: "POST" })
  .reply((opts) => {
    record("POST", "/v1/customers", opts.body);
    return json(200, { id: `cus_mock_${Date.now()}`, object: "customer" });
  })
  .persist();

stripe
  .intercept({ path: "/v1/checkout/sessions", method: "POST" })
  .reply((opts) => {
    record("POST", "/v1/checkout/sessions", opts.body);
    return json(200, {
      id: `cs_mock_${Date.now()}`,
      object: "checkout.session",
      // Points straight at this app's own real post-checkout success URL rather than attempting to simulate Stripe's own hosted
      // checkout UI: the value here is verifying what *this app* does once Stripe reports success, not re-testing Stripe's pages.
      url: `${siteUrl}/dashboard/settings?tab=billing&checkout=success`,
    });
  })
  .persist();

stripe
  .intercept({ path: "/v1/billing_portal/sessions", method: "POST" })
  .reply((opts) => {
    record("POST", "/v1/billing_portal/sessions", opts.body);
    return json(200, { id: `bps_mock_${Date.now()}`, object: "billing_portal.session", url: `${siteUrl}/dashboard/settings?tab=billing` });
  })
  .persist();

// Retrieve / update an existing subscription (plan change, cancel at period end, reactivate).
stripe
  .intercept({ path: (path) => /^\/v1\/subscriptions\/sub_[\w]+$/.test(path), method: "GET" })
  .reply((opts) => {
    record("GET", opts.path, "");
    return json(200, { id: opts.path.split("/").pop(), object: "subscription", status: "active", items: { object: "list", data: [{ id: "si_mock_item", object: "subscription_item", price: { id: "price_e2e_current" } }] } });
  })
  .persist();

stripe
  .intercept({ path: (path) => /^\/v1\/subscriptions\/sub_[\w]+$/.test(path), method: "POST" })
  .reply((opts) => {
    record("POST", opts.path, opts.body);
    return json(200, { id: opts.path.split("/").pop(), object: "subscription", status: "active", items: { object: "list", data: [{ id: "si_mock_item", object: "subscription_item" }] } });
  })
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

// ---------------------------------------------------------------------
// Voice interview providers — src/lib/voice/providers/*. As with the mocks above, only the network I/O is swapped;
// the app's own upload validation, provider seam, error mapping and route code all run for real. These check the
// pieces the app is responsible for getting right (the right key, the right voice, a genuine recording actually
// reaching the STT provider); they cannot say anything about the real providers' accuracy or accent.
// ---------------------------------------------------------------------

// A valid MPEG-1 Layer III frame header (128 kbps, 44.1 kHz, no padding => 417-byte frames) followed by zeroed
// payload decodes as silence — a real, playable MP3 a browser <audio> element accepts, ~1s long.
const SILENT_MP3 = Buffer.concat(
  Array.from({ length: 40 }, () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(413)])),
);

/** Reads a request header regardless of the casing the caller used (undici hands the mock the headers as sent). */
function headerValue(headers, name) {
  if (!headers) return undefined;
  if (Array.isArray(headers)) {
    for (let i = 0; i + 1 < headers.length; i += 2) if (String(headers[i]).toLowerCase() === name) return String(headers[i + 1]);
    return undefined;
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key]) : undefined;
}

mockAgent
  .get("https://api.openai.com")
  .intercept({ path: "/v1/audio/transcriptions", method: "POST" })
  .reply(({ body, headers }) => {
    if (headerValue(headers, "authorization") !== "Bearer e2e-openai-key") return json(401, { error: { message: "bad key" } });
    // The body arrives as a FormData (undici hands the mock the original object) — a real MediaRecorder take is
    // several KB; a stub/empty upload would not be.
    const file = body && typeof body.get === "function" ? body.get("file") : null;
    const model = body && typeof body.get === "function" ? body.get("model") : null;
    if (!file || typeof file.size !== "number" || file.size < 500 || model !== "whisper-1") {
      return json(400, { error: { message: "not a real recording" } });
    }
    return json(200, { text: `I rebuilt the deployment pipeline and cut deploy time (${file.type}, ${file.size} bytes heard).` });
  })
  .persist();

mockAgent
  .get("https://api.elevenlabs.io")
  // Only the operator-configured British voice id is mocked — a call to any other voice id falls through to the real
  // network and fails, which is what proves the app really uses ELEVENLABS_VOICE_ID.
  .intercept({ path: "/v1/text-to-speech/e2e-british-voice", method: "POST" })
  .reply(({ headers, body }) => {
    if (headerValue(headers, "xi-api-key") !== "e2e-eleven-key") return { statusCode: 401, data: "" };
    const request = JSON.parse(typeof body === "string" ? body : "{}");
    if (typeof request.text !== "string" || request.text.length === 0) return { statusCode: 400, data: "" };
    return { statusCode: 200, data: SILENT_MP3, responseOptions: { headers: { "content-type": "audio/mpeg" } } };
  })
  .persist();

// ---------------------------------------------------------------------
// GitHub Actions workflow dispatch — src/lib/admin/sponsors/actions.ts's "Run sync now". Only the one repository /
// workflow / token the e2e server is started with (SPONSOR_SYNC_GITHUB_REPO=e2e-org/e2e-repo,
// SPONSOR_SYNC_GITHUB_TOKEN=e2e-github-token) is mocked, and it answers like GitHub does: 204 when the token, ref
// and inputs are right, 401 for a wrong token, 422 for a body GitHub would reject. It cannot say the real
// GitHub accepts that repo/token — only that the app sends the request GitHub's API documents.
// ---------------------------------------------------------------------

mockAgent
  .get("https://api.github.com")
  .intercept({ path: "/repos/e2e-org/e2e-repo/actions/workflows/sponsors-sync.yml/dispatches", method: "POST" })
  .reply(({ body, headers }) => {
    if (headerValue(headers, "authorization") !== "Bearer e2e-github-token") return json(401, { message: "Bad credentials" });
    let request = {};
    try {
      request = JSON.parse(typeof body === "string" ? body : "{}");
    } catch {
      return json(422, { message: "Problems parsing JSON" });
    }
    if (request.ref !== "main" || request.inputs !== undefined) return json(422, { message: "Unexpected inputs" });
    return { statusCode: 204, data: "" };
  })
  .persist();

// ---------------------------------------------------------------------
// Job feeds — src/lib/jobs/adapters/{adzuna,reed}. Only the network I/O is swapped: the real adapters, normalizers,
// sync runner, dedupe and database writes all run. The provider's response is chosen by the `keywords` the test sends
// through the cron route, so each scenario is explicit:
//   e2e-good     a realistic page of listings (some at real register sponsors, one repeated id, in-batch and
//                cross-source duplicates, malformed rows, a listing that has already expired)
//   e2e-401      the provider rejects the credentials
//   e2e-500      the provider errors
//   e2e-html     a 200 that isn't JSON (a maintenance page)
//   e2e-shape    a 200 JSON body with no results list (the provider changed its format)
//   e2e-429-ok   throttled once (Retry-After: 0), then answers
//   e2e-429-always  throttled on every request
// Every external id starts with "e2e-" so the specs can find and delete exactly what they created. The listings are
// test data for exercising the pipeline and are removed afterwards; none of this is ever seeded.
// The mocked credentials are ADZUNA_APP_ID=e2e-adzuna-id, ADZUNA_APP_KEY=e2e-adzuna-key, REED_API_KEY=e2e-reed-key.
// ---------------------------------------------------------------------

const DAY_MS = 86_400_000;
const isoDaysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();
const reedDate = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * DAY_MS);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

function adzunaListing(id, title, company, location, daysAgo, description) {
  return {
    id,
    title,
    description,
    created: isoDaysAgo(daysAgo),
    redirect_url: `https://www.adzuna.co.uk/jobs/land/ad/${id}`,
    company: { __CLASS__: "Adzuna::API::Response::Company", display_name: company },
    location: { __CLASS__: "Adzuna::API::Response::Location", display_name: location, area: ["UK", location] },
  };
}

function reedListing(id, title, employer, location, postedDaysAgo, expiresInDays, description) {
  return {
    jobId: id,
    employerName: employer,
    jobTitle: title,
    locationName: location,
    currency: "GBP",
    date: reedDate(-postedDaysAgo),
    expirationDate: reedDate(expiresInDays),
    jobDescription: description,
    jobUrl: `https://www.reed.co.uk/jobs/${id}`,
  };
}

const ADZUNA_GOOD = () => [
  adzunaListing("e2e-adz-1", "E2E Data Analyst", "Rolls-Royce plc", "Derby, Derbyshire", 1, "Build reporting in SQL and Power BI for the engineering finance team. Stakeholder management essential."),
  adzunaListing("e2e-adz-2", "E2E Nurse Practitioner", "E2E Fictional Employer Ltd", "Leeds, West Yorkshire", 2, "Registered nurse needed on a busy ward. NMC registration required."),
  adzunaListing("e2e-adz-3", "E2E Software Engineer", "Barclays Bank PLC", "London", 3, "Backend engineer working with TypeScript and Kubernetes on payments infrastructure."),
  adzunaListing("e2e-adz-1", "E2E Data Analyst", "Rolls-Royce plc", "Derby, Derbyshire", 1, "Build reporting in SQL and Power BI for the engineering finance team. Stakeholder management essential."), // repeated id
  adzunaListing("e2e-adz-5", "E2E Nurse Practitioner", "E2E Fictional Employer Ltd", "Leeds, West Yorkshire", 2, "Same role advertised twice by the same employer."), // in-batch duplicate of adz-2
  { id: "e2e-adz-bad-1", title: "No company here", description: "x", redirect_url: "https://www.adzuna.co.uk/x", location: { display_name: "Leeds" } }, // malformed
  { ...adzunaListing("e2e-adz-bad-2", "Bad link", "Someone Ltd", "Leeds", 1, "x"), redirect_url: "javascript:alert(1)" }, // malformed
];

const REED_GOOD = () => [
  reedListing("e2e-reed-1", "E2E Data Analyst", "Rolls-Royce plc", "Derby, Derbyshire", 1, 20, "Same role Adzuna lists; Reed carries a real closing date."), // cross-source duplicate of e2e-adz-1
  reedListing("e2e-reed-2", "E2E Marketing Lead", "E2E Fictional Employer Ltd", "Bristol", 2, 10, "Lead campaigns across paid and lifecycle channels."),
  reedListing("e2e-reed-3", "E2E Closing Analyst", "E2E Fictional Employer Ltd", "Manchester", 8, -1, "This closed yesterday."), // already expired
  { jobId: "e2e-reed-bad-1", jobTitle: "Missing employer", jobDescription: "x", jobUrl: "https://www.reed.co.uk/x", locationName: "Leeds" }, // malformed
];

const throttled = new Map();

function feedReply(provider, keywords, page, listings) {
  const key = `${provider}:${keywords}`;
  switch (keywords) {
    case "e2e-good":
      return json(200, { count: listings.length, results: page === 1 ? listings : [] });
    case "e2e-401":
      return json(401, { error: "Invalid credentials" });
    case "e2e-500":
      return json(500, { error: "upstream exploded" });
    case "e2e-html":
      return { statusCode: 200, data: "<html><body>Scheduled maintenance</body></html>", responseOptions: { headers: { "content-type": "text/html" } } };
    case "e2e-shape":
      return json(200, { message: "results moved", data: [] });
    case "e2e-429-ok": {
      const seen = throttled.get(key) ?? 0;
      throttled.set(key, seen + 1);
      if (seen === 0) return { statusCode: 429, data: "slow down", responseOptions: { headers: { "retry-after": "0" } } };
      return json(200, { count: listings.length, results: page === 1 ? listings : [] });
    }
    case "e2e-429-always":
      return { statusCode: 429, data: "slow down", responseOptions: { headers: { "retry-after": "0" } } };
    default:
      return json(200, { count: 0, results: [] });
  }
}

mockAgent
  .get("https://api.adzuna.com")
  .intercept({ path: (path) => path.startsWith("/v1/api/jobs/gb/search/"), method: "GET" })
  .reply(({ path }) => {
    const url = new URL(path, "https://api.adzuna.com");
    if (url.searchParams.get("app_id") !== "e2e-adzuna-id" || url.searchParams.get("app_key") !== "e2e-adzuna-key") {
      return json(401, { error: "Invalid app_id or app_key" });
    }
    const page = Number(url.pathname.split("/").pop());
    return feedReply("adzuna", url.searchParams.get("what") ?? "", page, ADZUNA_GOOD());
  })
  .persist();

mockAgent
  .get("https://www.reed.co.uk")
  .intercept({ path: (path) => path.startsWith("/api/1.0/search"), method: "GET" })
  .reply(({ path, headers }) => {
    if (headerValue(headers, "authorization") !== `Basic ${Buffer.from("e2e-reed-key:").toString("base64")}`) {
      return json(401, { message: "Unauthorized" });
    }
    const url = new URL(path, "https://www.reed.co.uk");
    const page = Number(url.searchParams.get("resultsToSkip") ?? "0") === 0 ? 1 : 2;
    return feedReply("reed", url.searchParams.get("keywords") ?? "", page, REED_GOOD());
  })
  .persist();

console.log("[e2e] Provider mocks installed: api.anthropic.com, api.stripe.com, api.resend.com, api.openai.com, api.elevenlabs.io, api.github.com, api.adzuna.com, www.reed.co.uk");
