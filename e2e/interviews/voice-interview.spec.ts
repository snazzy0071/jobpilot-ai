import { expect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded, setPlan } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked, DESKTOP, PHONE, type Viewport } from "../support/cv-fixture";

// Voice Interview: a real browser recording (MediaRecorder, fed by Chromium's fake microphone), uploaded to the real
// /transcribe route and on to the STT provider, the same AI interviewer as text mode, the interviewer's turns read
// aloud through the real /speak route and TTS provider, transcript, scoring/results, mobile behaviour, error
// recovery, voice quota and audio cleanup.
//
// What this does and does not prove. The app's code — upload validation, the provider seam, key/voice-id handling,
// error mapping, rate limiting, the recording/playback UI — all runs for real. The two providers' HTTP endpoints
// (api.openai.com Whisper, api.elevenlabs.io) are intercepted at the network layer by e2e/support/mock-providers,
// exactly like Anthropic/Stripe/Resend, because this environment has no OPENAI/ELEVENLABS keys. So this verifies the
// integration, NOT the real providers' transcription accuracy or that the configured voice is actually British —
// only a run against real keys can. (The mock does insist on the right API key, the configured voice id, a
// multi-KB real recording and the whisper-1 model.) The "microphone" is Chromium's synthetic fake device.

const test = makeCvTest({ name: "Voice Interview Tester", plan: "elite" });
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  },
});
const db = () => getAdminClient();

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const VOICE_METRIC = "voice_interviews_per_month";

const VOICE_INSTRUMENTATION = () => {
  const w = window as unknown as { __voice: Record<string, unknown> };
  const state = { tracks: [] as MediaStreamTrack[], created: [] as string[], revoked: [] as string[], denyMic: false, rejectNextPlay: false };
  w.__voice = state;

  const media = navigator.mediaDevices;
  if (media?.getUserMedia) {
    const original = media.getUserMedia.bind(media);
    media.getUserMedia = async (constraints) => {
      if (state.denyMic) throw new DOMException("Permission denied", "NotAllowedError");
      const stream = await original(constraints);
      stream.getTracks().forEach((track) => state.tracks.push(track));
      return stream;
    };
  }
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const url = create(blob as Blob);
    state.created.push(url);
    return url;
  };
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (url) => {
    state.revoked.push(url);
    revoke(url);
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (state.rejectNextPlay) {
      state.rejectNextPlay = false;
      return Promise.reject(new DOMException("play() blocked", "NotAllowedError"));
    }
    return play.call(this);
  };
};

type VoiceProbe = { tracks: { readyState: string }[]; created: string[]; revoked: string[] };
const probe = (page: Page): Promise<VoiceProbe> =>
  page.evaluate(() => {
    const v = (window as unknown as { __voice: { tracks: MediaStreamTrack[]; created: string[]; revoked: string[] } }).__voice;
    return { tracks: v.tracks.map((t) => ({ readyState: t.readyState })), created: v.created, revoked: v.revoked };
  });
const setVoiceFlag = (page: Page, flag: "denyMic" | "rejectNextPlay", value: boolean) =>
  page.evaluate(([f, v]) => ((window as unknown as { __voice: Record<string, unknown> }).__voice[f as string] = v), [flag, value] as const);

async function setupVoiceInterview(page: Page, company = "Voice Co", role = "Voice Engineer") {
  await page.goto("/dashboard/interview/new");
  await dismissCookieBanner(page);
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Role").fill(role);
  await page.getByRole("combobox", { name: "Interview type" }).click();
  await page.getByRole("option", { name: "Voice", exact: true }).click();
  await page.getByRole("button", { name: "Start interview" }).click();
  await page.waitForURL(/\/dashboard\/interview\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await dismissCookieBanner(page);
  return page.url().split("/").pop()!;
}

// The app renders its errors as <p role="alert">; Next also keeps an empty, always-present role="alert" route announcer
// on the page, which a bare getByRole("alert") matches too.
const appAlert = (page: Page) => page.locator("p[role=alert]");
const rateLimited = (page: Page) => appAlert(page).filter({ hasText: /too quickly/i });

/** Begin is an AI call, so the gateway's real 10/60s per-user limit can refuse it right after a previous test — wait and retry, as a person would. */
async function beginVoiceInterview(page: Page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.getByRole("button", { name: "Begin interview" }).click();
    await expect(page.getByRole("button", { name: /Starting/ })).toHaveCount(0, { timeout: 60_000 });
    if (!(await rateLimited(page).isVisible().catch(() => false))) return;
    await page.waitForTimeout(15_000);
  }
  throw new Error("Still rate limited after 8 retries.");
}

/** A real MediaRecorder take from the fake microphone, uploaded to the real transcribe route, ending on the review step. Retries only the (separate, 10/60s) transcribe rate limit. */
async function recordAnswer(page: Page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.getByRole("button", { name: "Record your answer" }).click();
    await expect(page.getByText(/Recording… 0:0/)).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Stop recording" }).click();
    const review = page.getByLabel("Edit your transcribed answer");
    await expect(review.or(appAlert(page))).toBeVisible({ timeout: 30_000 });
    if (await review.isVisible()) return review;
    if (!(await rateLimited(page).isVisible().catch(() => false))) throw new Error("Transcription failed for a reason other than rate limiting.");
    await page.waitForTimeout(15_000);
  }
  throw new Error("Still rate limited after 6 retries.");
}

async function sendReviewedAnswer(page: Page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: /Thinking/ })).toHaveCount(0, { timeout: 60_000 });
    if (!(await rateLimited(page).isVisible().catch(() => false))) return;
    await page.waitForTimeout(15_000);
  }
  throw new Error("Still rate limited after 8 retries.");
}

const sessionOf = async (id: string) => (await db().from("interview_sessions").select("*").eq("id", id).single()).data!;
const questionsOf = async (id: string) => (await db().from("interview_questions").select("id").eq("session_id", id)).data ?? [];
const voiceUsed = async (userId: string) =>
  (await db().from("subscription_usage").select("used_count").eq("user_id", userId).eq("metric", VOICE_METRIC).maybeSingle()).data?.used_count ?? 0;

const periodStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};
const periodEnd = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
};

/** A ~5 KB blob with a real container signature, posted the way the app's own client does. */
async function postRecording(page: Page, sessionId: string, options: { type: string; bytes: number[]; size?: number }) {
  return page.evaluate(
    async ({ sessionId, type, bytes, size }) => {
      const data = new Uint8Array(size).fill(7);
      data.set(bytes.slice(0, size), 0);
      const form = new FormData();
      form.append("audio", new Blob([data], { type }), "answer.bin");
      const response = await fetch(`/api/interview/${sessionId}/transcribe`, { method: "POST", body: form });
      return { status: response.status, body: (await response.json()) as { text?: string; error?: string } };
    },
    { sessionId, type: options.type, bytes: options.bytes, size: options.size ?? 5000 },
  );
}
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const MP4_MAGIC = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]; // ....ftypmp42

async function withUserOnPlan(browser: Browser, plan: "pro" | "premium" | "elite", run: (page: Page, user: IsolatedUser, cv: { versionId: string }) => Promise<void>) {
  const user = await createIsolatedUser({ fullName: `Voice ${plan} Tester` });
  try {
    await markOnboarded(user.id);
    await setPlan(user.id, plan);
    const cv = await seedCv(user.id);
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard$/);
    await run(page, user, cv);
    await context.close();
  } finally {
    await deleteIsolatedUser(user.id);
  }
}

async function openVoiceSession(open: (viewport?: Viewport) => Promise<Page>, userId: string, viewport?: Viewport) {
  await seedCv(userId);
  const page = await open(viewport);
  await page.addInitScript(VOICE_INSTRUMENTATION);
  const sessionId = await setupVoiceInterview(page);
  return { page, sessionId };
}

test.describe("a full voice interview: recording, STT, AI, TTS, transcript, scoring", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("speak each answer, hear each question, and finish with a scored, persisted session", async ({ open, account }) => {
    test.setTimeout(420_000);
    const usedBefore = await voiceUsed(account.user.id);
    const { page, sessionId } = await openVoiceSession(open, account.user.id);

    const session = await sessionOf(sessionId);
    expect(session.mode).toBe("voice");
    await expect(page.getByText("Voice", { exact: false }).first()).toBeVisible();

    const speakResponses: { status: number; type: string | undefined }[] = [];
    page.on("response", (response) => {
      if (response.url().includes(`/api/interview/${sessionId}/speak`)) {
        speakResponses.push({ status: response.status(), type: response.headers()["content-type"] });
      }
    });

    await beginVoiceInterview(page);
    expect(await voiceUsed(account.user.id)).toBe(usedBefore + 1); // one credit, spent at Begin
    await expect(page.getByRole("button", { name: "Replay question" })).toBeVisible(); // the first question was voiced

    for (let i = 0; i < 15; i++) {
      if (await page.getByRole("link", { name: "View full results" }).isVisible().catch(() => false)) break;
      const review = await recordAnswer(page);
      // The recording really went through the STT provider: the mock only answers a multi-KB whisper-1 upload made
      // with the configured key, and its transcript says how many bytes it heard.
      await expect(review).toHaveValue(/bytes heard/);
      await sendReviewedAnswer(page);
    }
    await expect(page.getByRole("link", { name: "View full results" })).toBeVisible();

    // Every interviewer turn that had a question in it was voiced through the real speak route.
    expect(speakResponses.length).toBeGreaterThanOrEqual(5);
    expect(speakResponses.every((r) => r.status === 200 && r.type === "audio/mpeg")).toBe(true);

    // Persisted like a text interview, plus the measured speaking time only a voice answer has.
    const questions = await questionsOf(sessionId);
    expect(questions.length).toBeGreaterThanOrEqual(5);
    const { data: answers } = await db()
      .from("interview_answers")
      .select("answer_text, duration_seconds")
      .in("question_id", questions.map((q) => q.id));
    expect(answers!.length).toBe(questions.length);
    for (const answer of answers!) {
      expect(answer.answer_text).toContain("bytes heard");
      expect(answer.duration_seconds).toBeGreaterThanOrEqual(1);
    }
    const { data: turns } = await db().from("interview_transcripts").select("speaker").eq("session_id", sessionId).order("sequence_index");
    for (let i = 1; i < turns!.length; i++) expect(turns![i].speaker === "candidate" && turns![i - 1].speaker === "candidate").toBe(false);

    const finished = await sessionOf(sessionId);
    expect(finished.status).toBe("completed");
    expect(finished.overall_score).not.toBeNull();
    expect(await voiceUsed(account.user.id)).toBe(usedBefore + 1); // answering never spent more

    await page.getByRole("link", { name: "View full results" }).click();
    await expect(page.getByText("/ 100 overall")).toBeVisible();
    await expect(page.getByRole("img", { name: "Competency scores" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Full transcript" })).toBeVisible();
    await expect(page.getByText("bytes heard").first()).toBeVisible();
  });
});

test.describe("interviewer audio and microphone lifecycle", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("the question is read aloud as playable audio, can be replayed, and audio/mic resources are released", async ({ open, account }) => {
    test.setTimeout(240_000);
    const { page } = await openVoiceSession(open, account.user.id);
    await beginVoiceInterview(page);

    const audio = page.locator("audio");
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration), { timeout: 15_000 }).toBeGreaterThan(0.3);
    expect(await audio.evaluate((el: HTMLAudioElement) => el.src.startsWith("blob:"))).toBe(true);
    await page.getByRole("button", { name: "Replay question" }).click();
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime >= 0 && !el.error)).toBe(true);

    // Answering gets a follow-up, which is voiced too — and the previous clip's blob URL is released, not leaked.
    await recordAnswer(page);
    // Stopping released the microphone: no track is left live.
    expect((await probe(page)).tracks.every((t) => t.readyState === "ended")).toBe(true);
    await sendReviewedAnswer(page);
    await expect.poll(async () => (await probe(page)).created.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    const afterTwoClips = await probe(page);
    expect(afterTwoClips.revoked).toContain(afterTwoClips.created[0]);

    // Leaving the page releases the last clip too.
    await page.getByRole("link", { name: "All sessions" }).click();
    await page.waitForURL(/\/dashboard\/interview$/);
    await expect
      .poll(async () => {
        const afterLeaving = await probe(page);
        return afterLeaving.created.every((url) => afterLeaving.revoked.includes(url));
      }, { timeout: 5_000 })
      .toBe(true);
  });

  test("leaving the page mid-recording releases the microphone", async ({ open, account }) => {
    test.setTimeout(240_000);
    const { page } = await openVoiceSession(open, account.user.id);
    await beginVoiceInterview(page);

    await page.getByRole("button", { name: "Record your answer" }).click();
    await expect(page.getByText(/Recording…/)).toBeVisible();
    expect((await probe(page)).tracks.some((t) => t.readyState === "live")).toBe(true);

    await page.getByRole("link", { name: "All sessions" }).click();
    await page.waitForURL(/\/dashboard\/interview$/);
    // Before this was fixed the timer stopped but the stream stayed open — the browser's "recording" indicator stayed
    // on after leaving the page.
    await expect.poll(async () => (await probe(page)).tracks.every((t) => t.readyState === "ended"), { timeout: 5_000 }).toBe(true);
  });
});

test.describe("error recovery", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("a denied microphone, a failed transcription, failed audio and a dropped connection each explain themselves and recover", async ({ open, account }) => {
    test.setTimeout(300_000);
    const { page, sessionId } = await openVoiceSession(open, account.user.id);

    // TTS failure: the question is still readable, and the audio can be retried.
    let failSpeak = true;
    await page.route("**/api/interview/*/speak", (route) =>
      failSpeak ? route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Couldn't generate audio — try again." }) }) : route.continue(),
    );
    await beginVoiceInterview(page);
    await expect(page.getByText(/Couldn't play that aloud/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry audio" })).toBeVisible();
    failSpeak = false;
    await page.getByRole("button", { name: "Retry audio" }).click();
    await expect(page.getByRole("button", { name: "Replay question" })).toBeVisible();

    // Microphone denied: a clear message, and allowing it afterwards just works.
    await setVoiceFlag(page, "denyMic", true);
    await page.getByRole("button", { name: "Record your answer" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /microphone/i })).toBeVisible();
    await setVoiceFlag(page, "denyMic", false);

    // Transcription fails twice (no speech, then a provider error), then succeeds — always back to a usable state.
    let transcribeAttempts = 0;
    await page.route("**/api/interview/*/transcribe", (route) => {
      transcribeAttempts += 1;
      if (transcribeAttempts === 1) return route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "Couldn't make out any speech in that recording — try again." }) });
      if (transcribeAttempts === 2) return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Couldn't transcribe that recording — try again." }) });
      return route.continue();
    });
    await page.getByRole("button", { name: "Record your answer" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /make out any speech/ })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Record your answer" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Couldn't transcribe/ })).toBeVisible({ timeout: 20_000 });
    const review = await recordAnswer(page);
    await expect(review).toHaveValue(/bytes heard/);

    // The connection drops as the reviewed answer is sent: an error, not a stuck "Thinking…" — and the transcribed
    // answer is still there to send again.
    let dropNext = true;
    await page.route(`**/dashboard/interview/${sessionId}`, (route) => {
      if (dropNext && route.request().method() === "POST") {
        dropNext = false;
        return route.abort();
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /reach the server/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Thinking/ })).toHaveCount(0);
    await expect(review).toHaveValue(/bytes heard/);
    await sendReviewedAnswer(page);
    await expect(page.getByLabel("Edit your transcribed answer")).toHaveCount(0); // sent, back to ready-to-record
    await expect(page.getByRole("button", { name: "Record your answer" })).toBeVisible();
  });

  test("a browser with no microphone support says so", async ({ open, account }) => {
    test.setTimeout(240_000);
    const { page } = await openVoiceSession(open, account.user.id);
    await beginVoiceInterview(page);
    await page.evaluate(() => Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true }));
    await page.getByRole("button", { name: "Record your answer" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /can't record audio/i })).toBeVisible();
  });
});

test.describe("mobile microphone support", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("on a phone-sized screen: blocked autoplay still lets you hear the question, recording works, and nothing overflows", async ({ open, account }) => {
    test.setTimeout(300_000);
    const { page } = await openVoiceSession(open, account.user.id, PHONE);

    // iOS Safari refuses to autoplay audio started after an async fetch. Simulate exactly that refusal.
    await setVoiceFlag(page, "rejectNextPlay", true);
    await beginVoiceInterview(page);
    await expect(page.getByText(/blocked autoplay/)).toBeVisible();
    const replay = page.getByRole("button", { name: "Replay question" });
    await expect(replay).toBeVisible();
    await replay.click(); // a real tap target: this play() comes from a user gesture
    await expect(page.getByText(/blocked autoplay/)).toHaveCount(0);
    await expect.poll(() => page.locator("audio").evaluate((el: HTMLAudioElement) => !el.error && el.readyState >= 1), { timeout: 10_000 }).toBe(true);

    const review = await recordAnswer(page);
    await expect(review).toBeVisible();
    for (const name of ["Send", "Re-record"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await sendReviewedAnswer(page);
    await expect(page.getByRole("button", { name: "Record your answer" })).toBeVisible();
  });

  test("Safari's audio/mp4 recordings and Chrome's webm are both accepted, and anything else is refused", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open(PHONE);
    const sessionId = await setupVoiceInterview(page);

    const webm = await postRecording(page, sessionId, { type: "audio/webm;codecs=opus", bytes: WEBM_MAGIC });
    expect(webm.status).toBe(200);
    expect(webm.body.text).toMatch(/bytes heard/);
    const mp4 = await postRecording(page, sessionId, { type: "audio/mp4", bytes: MP4_MAGIC }); // what iOS Safari's MediaRecorder produces
    expect(mp4.status).toBe(200);
    expect(mp4.body.text).toMatch(/audio\/mp4/);

    expect((await postRecording(page, sessionId, { type: "audio/webm", bytes: [0x4d, 0x5a, 0x90, 0x00] })).status).toBe(400); // an executable claiming to be webm
    expect((await postRecording(page, sessionId, { type: "audio/mp4", bytes: WEBM_MAGIC })).status).toBe(400); // container doesn't match the declared type
    expect((await postRecording(page, sessionId, { type: "application/pdf", bytes: WEBM_MAGIC })).status).toBe(400);
    expect((await postRecording(page, sessionId, { type: "audio/webm", bytes: WEBM_MAGIC, size: 0 })).status).toBe(400); // empty
  });
});

test.describe("temporary audio cleanup and route protection", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("audio is processed in memory and never stored; the routes refuse foreign origins, other modes and unknown sessions", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    const voiceSessionId = await setupVoiceInterview(page);

    const before = await db().storage.listBuckets();
    const listObjects = async () => {
      const counts: Record<string, number> = {};
      for (const bucket of before.data ?? []) counts[bucket.name] = ((await db().storage.from(bucket.name).list("", { limit: 1000 })).data ?? []).length;
      return counts;
    };
    const objectsBefore = await listObjects();

    const ok = await postRecording(page, voiceSessionId, { type: "audio/webm", bytes: WEBM_MAGIC });
    expect(ok.status).toBe(200);

    // Nothing written anywhere: no storage object, and the only thing a spoken answer ever becomes is its text.
    expect(await listObjects()).toEqual(objectsBefore);
    const { data: answer } = await db().from("interview_answers").select("*").limit(1);
    expect(Object.keys(answer?.[0] ?? { answer_text: 1, duration_seconds: 1 }).some((key) => /audio|blob|recording|url/i.test(key))).toBe(false);

    // Same-origin only.
    const foreign = await page.request.post(`/api/interview/${voiceSessionId}/transcribe`, {
      headers: { origin: "https://evil.example" },
      multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.from([...WEBM_MAGIC, ...new Array(600).fill(7)]) } },
    });
    expect(foreign.status()).toBe(403);
    const foreignSpeak = await page.request.post(`/api/interview/${voiceSessionId}/speak`, {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: { turnId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(foreignSpeak.status()).toBe(403);

    // A chat session, a made-up session and a finished one are not transcribable.
    await page.goto("/dashboard/interview/new");
    await page.getByLabel("Company").fill("Chat Co");
    await page.getByLabel("Role").fill("Chat Role");
    await page.getByRole("button", { name: "Start interview" }).click();
    await page.waitForURL(/\/dashboard\/interview\/[0-9a-f-]{36}$/);
    const chatSessionId = page.url().split("/").pop()!;
    expect((await postRecording(page, chatSessionId, { type: "audio/webm", bytes: WEBM_MAGIC })).status).toBe(400);
    expect((await postRecording(page, "22222222-2222-4222-8222-222222222222", { type: "audio/webm", bytes: WEBM_MAGIC })).status).toBe(404);
    await db().from("interview_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", voiceSessionId);
    expect((await postRecording(page, voiceSessionId, { type: "audio/webm", bytes: WEBM_MAGIC })).status).toBe(400);

    // Speak reads the stored interviewer turn only — never client-supplied text, never the candidate's own words.
    const speak = (turnId: string) => page.evaluate(async ({ id, turnId }) => (await fetch(`/api/interview/${id}/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId }) })).status, { id: voiceSessionId, turnId });
    expect(await speak("33333333-3333-4333-8333-333333333333")).toBe(404);
  });
});

test.describe("voice quota", () => {
  test.skip(!providersMocked, "needs the mocked AI/STT/TTS providers (E2E_MOCK_PROVIDERS=1)");

  test("Pro has no voice interviews: offered as unavailable in the UI and refused by the server", async ({ browser }) => {
    test.setTimeout(180_000);
    await withUserOnPlan(browser, "pro", async (page, user, cv) => {
      await page.goto("/dashboard/interview/new");
      await expect(page.getByText("Voice: Not included in your plan")).toBeVisible();
      await page.getByRole("combobox", { name: "Interview type" }).click();
      await expect(page.getByRole("option", { name: "Voice", exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");

      const { data: row } = await db()
        .from("interview_sessions")
        .insert({ user_id: user.id, role: "Engineer", company: "Pro Co", mode: "voice", difficulty: "medium", cv_version_id: cv.versionId, cv_text_snapshot: "Ada Persist" })
        .select("id")
        .single();
      await page.goto(`/dashboard/interview/${row!.id}`);
      await page.getByRole("button", { name: "Begin interview" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /plan|included/i })).toBeVisible({ timeout: 30_000 });
      expect((await questionsOf(row!.id)).length).toBe(0);
      expect(await voiceUsed(user.id)).toBe(0);
    });
  });

  test("Premium's 4 a month: the 5th is refused, with an upgrade path but no top-up", async ({ browser }) => {
    test.setTimeout(180_000);
    await withUserOnPlan(browser, "premium", async (page, user, cv) => {
      await db().from("subscription_usage").insert({ user_id: user.id, metric: VOICE_METRIC, period_start: periodStart(), period_end: periodEnd(), used_count: 4 });

      await page.goto("/dashboard/interview/new");
      await expect(page.getByText("Voice: 0 of 4 left this month")).toBeVisible();
      await expect(page.getByText("Upgrade to Elite")).toBeVisible();
      await expect(page.getByRole("button", { name: /Buy 5 more voice interviews/ })).toHaveCount(0);

      const { data: row } = await db()
        .from("interview_sessions")
        .insert({ user_id: user.id, role: "Engineer", company: "Premium Co", mode: "voice", difficulty: "medium", cv_version_id: cv.versionId, cv_text_snapshot: "Ada Persist" })
        .select("id")
        .single();
      await page.goto(`/dashboard/interview/${row!.id}`);
      await page.getByRole("button", { name: "Begin interview" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /all 4|allowance/i })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("link", { name: "Upgrade to Elite" })).toBeVisible();
      expect((await questionsOf(row!.id)).length).toBe(0);
      expect(await voiceUsed(user.id)).toBe(4); // a refused Begin never over-counts
    });
  });

  test("Elite's 10 a month: refused at 10, a purchased top-up (credited as the Stripe webhook does) unlocks more, and the buy button starts checkout", async ({ browser }) => {
    test.setTimeout(300_000);
    await withUserOnPlan(browser, "elite", async (page, user, cv) => {
      await db().from("subscription_usage").insert({ user_id: user.id, metric: VOICE_METRIC, period_start: periodStart(), period_end: periodEnd(), used_count: 10 });

      await page.goto("/dashboard/interview/new");
      await expect(page.getByText("Voice: 0 of 10 left this month")).toBeVisible();
      await expect(page.getByRole("button", { name: "Buy 5 more voice interviews" })).toBeVisible();

      const { data: row } = await db()
        .from("interview_sessions")
        .insert({ user_id: user.id, role: "Engineer", company: "Elite Co", mode: "voice", difficulty: "medium", cv_version_id: cv.versionId, cv_text_snapshot: "Ada Persist" })
        .select("id")
        .single();
      await page.goto(`/dashboard/interview/${row!.id}`);
      await page.getByRole("button", { name: "Begin interview" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /all 10|allowance/i })).toBeVisible({ timeout: 30_000 });
      expect((await questionsOf(row!.id)).length).toBe(0);
      expect(await voiceUsed(user.id)).toBe(10);

      // The buy button really starts a (mocked) Stripe Checkout session and sends the browser to its URL.
      await page.getByRole("button", { name: "Buy 5 more voice interviews" }).click();
      await page.waitForURL(/checkout=success/, { timeout: 30_000 });

      // The webhook is the only writer of a top-up (src/lib/billing/sync.ts); credit one exactly as it would.
      await db().from("voice_interview_topups").insert({ user_id: user.id, period_start: periodStart(), credits: 5, stripe_checkout_session_id: `cs_e2e_${Date.now()}` });
      await page.goto(`/dashboard/interview/${row!.id}`);
      await beginVoiceInterview(page);
      expect((await questionsOf(row!.id)).length).toBe(1);
      expect(await voiceUsed(user.id)).toBe(11); // 11 of 15
      await page.goto("/dashboard/interview/new");
      await expect(page.getByText("Voice: 4 of 15 left this month")).toBeVisible();
    });
  });
});
