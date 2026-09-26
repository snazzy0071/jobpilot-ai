import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateAudioUpload } from "@/lib/voice/validate-audio-upload";

const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04, 0x05]);
const MP4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypmp42"), Buffer.alloc(8)]);
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WAVE"), Buffer.alloc(4)]);

describe("validateAudioUpload", () => {
  it("accepts what real browsers record: Chrome/Firefox webm (with a codec parameter) and Safari/iOS mp4", () => {
    expect(validateAudioUpload(WEBM, "audio/webm;codecs=opus")).toEqual({ kind: "webm" });
    expect(validateAudioUpload(WEBM, "audio/webm")).toEqual({ kind: "webm" });
    // iOS Safari's MediaRecorder produces audio/mp4 — the mobile-microphone path.
    expect(validateAudioUpload(MP4, "audio/mp4")).toEqual({ kind: "mp4" });
    expect(validateAudioUpload(WAV, "audio/wav")).toEqual({ kind: "wav" });
  });

  it("never trusts the declared type alone: a spoofed or mismatched upload is rejected", () => {
    expect(validateAudioUpload(Buffer.from("MZ\x90\x00 not audio at all"), "audio/webm")).toEqual({
      error: "That doesn't look like a valid audio recording.",
    });
    expect(validateAudioUpload(MP4, "audio/webm")).toEqual({ error: "That recording's contents don't match its declared format." });
    expect(validateAudioUpload(WEBM, "application/pdf")).toEqual({ error: "That recording's format isn't supported." });
  });
});

describe("voice providers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.ELEVENLABS_API_KEY = "test-eleven-key";
    process.env.ELEVENLABS_VOICE_ID = "british-voice-123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  describe("speech-to-text (OpenAI Whisper)", () => {
    it("uploads the real recording with the configured key and returns the provider's transcript", async () => {
      const fetchMock = stubFetch(new Response(JSON.stringify({ text: "hello there" }), { status: 200 }));
      const { transcribeAudio } = await import("@/lib/voice/transcription");

      await expect(transcribeAudio(WEBM, "audio/webm", "answer.webm")).resolves.toBe("hello there");

      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-openai-key");
      const form = init.body as FormData;
      expect(form.get("model")).toBe("whisper-1");
      const file = form.get("file") as File;
      expect(file.name).toBe("answer.webm");
      expect(file.size).toBe(WEBM.length);
    });

    it.each([
      [401, "not_configured", "Voice features aren't available right now."],
      [403, "not_configured", "Voice features aren't available right now."],
      [400, "invalid_audio", "That recording couldn't be understood — try again."],
      [415, "invalid_audio", "That recording couldn't be understood — try again."],
      [500, "provider_error", "Couldn't transcribe that recording — try again."],
    ])("maps a %i from the provider to a safe, retryable message (%s)", async (status, code, message) => {
      stubFetch(new Response("provider internals we must never show", { status }));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { transcribeAudio, VoiceServiceError } = await import("@/lib/voice/transcription");

      const error = await transcribeAudio(WEBM, "audio/webm", "a.webm").catch((e) => e);
      expect(error).toBeInstanceOf(VoiceServiceError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.message).not.toContain("internals");
    });

    it("reports a network failure and a timeout distinctly, both retryable", async () => {
      const { VoiceServiceError } = await import("@/lib/voice/errors");
      stubFetch(new TypeError("fetch failed"));
      let mod = await import("@/lib/voice/transcription");
      let error = await mod.transcribeAudio(WEBM, "audio/webm", "a.webm").catch((e) => e);
      expect(error).toBeInstanceOf(VoiceServiceError);
      expect(error.code).toBe("provider_error");

      vi.resetModules();
      const timeout = new Error("timed out");
      timeout.name = "TimeoutError";
      stubFetch(timeout);
      mod = await import("@/lib/voice/transcription");
      error = await mod.transcribeAudio(WEBM, "audio/webm", "a.webm").catch((e) => e);
      expect(error.code).toBe("timeout");
    });

    it("says voice isn't available (rather than throwing a raw config error to the user) only via the provider path, and fails loudly when the key is missing", async () => {
      delete process.env.OPENAI_API_KEY;
      const { transcribeAudio } = await import("@/lib/voice/transcription");
      await expect(transcribeAudio(WEBM, "audio/webm", "a.webm")).rejects.toThrow(/isn't configured/);
    });
  });

  describe("text-to-speech (ElevenLabs)", () => {
    it("synthesizes with the operator-configured voice id and key", async () => {
      const audio = Buffer.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
      const fetchMock = stubFetch(new Response(audio, { status: 200, headers: { "content-type": "audio/mpeg" } }));
      const { synthesizeSpeech } = await import("@/lib/voice/speech");

      const result = await synthesizeSpeech("Tell me about a time you led a team.");
      expect(result.contentType).toBe("audio/mpeg");
      expect(result.audio.equals(audio)).toBe(true);

      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/british-voice-123");
      expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-eleven-key");
      expect(JSON.parse(init.body as string).text).toBe("Tell me about a time you led a team.");
    });

    it.each([
      [401, "not_configured"],
      [429, "provider_error"],
      [500, "provider_error"],
    ])("maps a %i to a safe error (%s)", async (status, code) => {
      stubFetch(new Response("internal", { status }));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { synthesizeSpeech, VoiceServiceError } = await import("@/lib/voice/speech");
      const error = await synthesizeSpeech("hi").catch((e) => e);
      expect(error).toBeInstanceOf(VoiceServiceError);
      expect(error.code).toBe(code);
      expect(error.message).not.toContain("internal");
    });
  });
});
