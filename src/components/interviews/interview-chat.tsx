"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2Icon, AlertCircleIcon, SendIcon, BarChart3Icon, MicIcon, SquareIcon, RotateCcwIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startInterview, submitInterviewAnswer } from "@/lib/interviews/chat-actions";
import { purchaseVoiceTopup } from "@/lib/interviews/topup-actions";
import { VOICE_TOPUP_CREDITS } from "@/lib/interviews/topup-config";
import { MessageBubble } from "@/components/interviews/message-bubble";
import { ScoreCard } from "@/components/interviews/score-card";
import { BillingActionButton } from "@/components/settings/billing-action-button";
import type { InterviewTranscriptTurn, InterviewStatus, InterviewAnswerScore, InterviewMode } from "@/lib/interviews/types";

/** One pass over the transcript, pairing each turn with the previous question's score when the conversation has just moved past it — computed as a plain function, not by mutating a variable inside .map() during render (React's compiler correctly flags that as unsafe). */
function buildTimeline(
  messages: InterviewTranscriptTurn[],
  scores: Record<string, InterviewAnswerScore>,
): { turn: InterviewTranscriptTurn; scoreBefore: InterviewAnswerScore | null }[] {
  const timeline: { turn: InterviewTranscriptTurn; scoreBefore: InterviewAnswerScore | null }[] = [];
  let previousQuestionId: string | null = null;
  for (const turn of messages) {
    const scoreBefore =
      previousQuestionId && previousQuestionId !== turn.questionId && scores[previousQuestionId] ? scores[previousQuestionId] : null;
    timeline.push({ turn, scoreBefore });
    previousQuestionId = turn.questionId;
  }
  return timeline;
}

const RECORDING_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDING_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Indirected through a module-level helper, not called as `Date.now()`
// directly inside the component — React's compiler flags a direct call
// to a known-impure global anywhere reachable from the component body as
// unsafe for render purity, even inside a closure that in practice only
// ever runs from an onClick handler, never during render itself.
function now(): number {
  return Date.now();
}

function isRecordingSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

type RecordingState = "idle" | "recording" | "transcribing" | "review";

// A spoken answer becomes the reply text, which submitInterviewAnswerSchema caps at 4000 characters (~700 words,
// roughly 4-5 minutes of speech). Without a recording ceiling, a long take transcribes to more than the server will
// accept and the candidate only finds out after the whole recording is done and transcribed.
const MAX_RECORDING_SECONDS = 180;
const MAX_ANSWER_CHARS = 4000;
const NETWORK_ERROR_MESSAGE = "Couldn't reach the server — check your connection and try again.";

/**
 * The live interview — Claude acts as the interviewer, one question at a
 * time, with contextual follow-ups, until 5-8 questions have been
 * covered (src/lib/interviews/chat-actions.ts enforces the bound
 * server-side regardless of what the model itself decides). Each
 * finished question's answer is scored against Situation/Task/Action/
 * Result/relevance/clarity/evidence and shown inline right after the
 * conversation moves past it. `mode` picks the answer-input UI: `chat`
 * types an answer directly; `voice` records it (MediaRecorder), uploads
 * for transcription (/api/interview/[id]/transcribe), and lets the
 * candidate review/edit the transcript before it's sent through the
 * exact same submitInterviewAnswer Server Action either mode uses — the
 * AI turn logic itself has no idea which mode produced the text. Voice
 * mode also plays each new interviewer turn aloud
 * (/api/interview/[id]/speak) in the operator-configured British voice,
 * with the full text always visible in the transcript too — audio is an
 * enhancement, never the only channel.
 */
export function InterviewChat({
  sessionId,
  mode,
  initialTranscript,
  initialStatus,
  initialScores,
  voiceTopupsAllowed,
}: {
  sessionId: string;
  mode: InterviewMode;
  initialTranscript: InterviewTranscriptTurn[];
  initialStatus: InterviewStatus;
  initialScores: Record<string, InterviewAnswerScore>;
  /** Elite's `voice_topups_allowed` feature flag — whether a "buy more" entry point should show alongside an out-of-voice-interviews error, as opposed to just the plain error text. */
  voiceTopupsAllowed: boolean;
}) {
  const [messages, setMessages] = useState(initialTranscript);
  const [scores, setScores] = useState(initialScores);
  const [status, setStatus] = useState(initialStatus);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  // Whether an interviewer turn's audio is loaded and can be (re)played by a tap. Autoplay after an async fetch is
  // refused by iOS Safari (and by Chrome for a page with no prior interaction), so a working tap target is the only
  // way to hear the question there — the earlier "Tap play to hear the question" notice had nothing to tap.
  const [audioReady, setAudioReady] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [recordingLimitReached, setRecordingLimitReached] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordedDurationSecondsRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      // Navigating away mid-recording must release the microphone — stopping the timer alone left the stream (and
      // the browser's "recording" indicator) live after leaving the page.
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);


  async function playInterviewerTurn(turns: InterviewTranscriptTurn[]) {
    const turn = [...turns].reverse().find((t) => t.speaker === "interviewer");
    if (!turn) return;

    setAudioNotice(null);
    setAudioFailed(false);
    try {
      const response = await fetch(`/api/interview/${sessionId}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId: turn.id }),
      });
      if (!response.ok) {
        setAudioFailed(true);
        setAudioNotice("Couldn't play that aloud — read the question above, or try the audio again.");
        return;
      }
      const blob = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        setAudioReady(true);
        await audioRef.current.play().catch(() => {
          setAudioNotice("Your browser blocked autoplay — tap “Replay question” to hear it.");
        });
      }
    } catch {
      setAudioFailed(true);
      setAudioNotice("Couldn't play that aloud — read the question above, or try the audio again.");
    }
  }

  function handleReplay() {
    setAudioNotice(null);
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => setAudioNotice("Couldn't play that aloud — read the question above instead."));
  }

  function handleRetryAudio() {
    void playInterviewerTurn(messages);
  }

  async function handleBegin() {
    setError(null);
    setQuotaExceeded(false);
    setLoading(true);
    let result: Awaited<ReturnType<typeof startInterview>>;
    try {
      result = await startInterview(sessionId);
    } catch {
      // A dropped connection rejects the Server Action call itself — without this the button stayed on "Starting…"
      // forever, with no message and no way to retry short of reloading.
      setLoading(false);
      setError(NETWORK_ERROR_MESSAGE);
      return;
    }
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      setQuotaExceeded(result.quotaExceeded ?? false);
      return;
    }
    setMessages(result.turns);
    setStatus(result.status);
    if (mode === "voice") void playInterviewerTurn(result.turns);
  }

  async function submitAnswer(text: string, durationSeconds?: number) {
    setError(null);
    setQuotaExceeded(false);
    setLoading(true);
    const previousInterviewerTurn = [...messages].reverse().find((m) => m.speaker === "interviewer");
    let result: Awaited<ReturnType<typeof submitInterviewAnswer>>;
    try {
      result = await submitInterviewAnswer(sessionId, text, durationSeconds);
    } catch {
      // Same as handleBegin: keep the typed/transcribed answer in place and let the candidate simply send it again.
      // Retrying is safe whenever the turn failed on the server (nothing is saved for a failed turn — see submitInterviewAnswer).
      setLoading(false);
      setError(NETWORK_ERROR_MESSAGE);
      return;
    }
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setMessages((prev) => [...prev, ...result.turns]);
    setStatus(result.status);
    setAnswerText("");
    setDraftText("");
    setRecordingState("idle");
    if (result.finishedQuestionScore && previousInterviewerTurn?.questionId) {
      const finishedQuestionId = previousInterviewerTurn.questionId;
      setScores((prev) => ({ ...prev, [finishedQuestionId]: result.finishedQuestionScore! }));
    }
    if (mode === "voice") void playInterviewerTurn(result.turns);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = answerText.trim();
    if (!trimmed) return;
    await submitAnswer(trimmed);
  }

  async function handleStartRecording() {
    setError(null);
    setAudioNotice(null);
    if (!isRecordingSupported()) {
      setError("This browser can't record audio — try Chrome, Edge, or Safari.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        void handleRecordingStopped(recorder.mimeType || mimeType || "audio/webm");
      };

      mediaRecorderRef.current = recorder;
      recordingStartRef.current = now();
      recorder.start();
      setElapsedSeconds(0);
      setRecordingLimitReached(false);
      setRecordingState("recording");
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
        if (now() - recordingStartRef.current >= MAX_RECORDING_SECONDS * 1000) {
          setRecordingLimitReached(true);
          handleStopRecording();
        }
      }, 1000);
    } catch {
      setError("Couldn't access your microphone — check your browser's permission for this site.");
    }
  }

  function handleStopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  }

  async function handleRecordingStopped(mimeType: string) {
    const durationSeconds = Math.max(1, Math.round((now() - recordingStartRef.current) / 1000));
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (blob.size === 0) {
      setError("That recording was empty — try again.");
      setRecordingState("idle");
      return;
    }

    setRecordingState("transcribing");
    setError(null);

    const formData = new FormData();
    formData.append("audio", blob, `answer.${mimeType.includes("mp4") ? "mp4" : "webm"}`);

    try {
      const response = await fetch(`/api/interview/${sessionId}/transcribe`, { method: "POST", body: formData });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        setError(data.error ?? "Couldn't transcribe that recording — try again.");
        setRecordingState("idle");
        return;
      }
      setDraftText(data.text.slice(0, MAX_ANSWER_CHARS));
      recordedDurationSecondsRef.current = durationSeconds;
      setRecordingState("review");
    } catch {
      setError("Couldn't transcribe that recording — try again.");
      setRecordingState("idle");
    }
  }

  async function handleSendVoiceAnswer() {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    await submitAnswer(trimmed, recordedDurationSecondsRef.current);
  }

  function handleDiscardRecording() {
    setDraftText("");
    setRecordingState("idle");
  }

  const timeline = buildTimeline(messages, scores);

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} className="hidden" />

      <div className="flex flex-col gap-3">
        {timeline.map(({ turn, scoreBefore }) => (
          <div key={turn.id} className="flex flex-col gap-3">
            {scoreBefore && <ScoreCard score={scoreBefore} />}
            <MessageBubble turn={turn} />
          </div>
        ))}
      </div>

      {mode === "voice" && (audioReady || audioFailed) && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={audioReady ? handleReplay : handleRetryAudio}>
          <Volume2Icon /> {audioReady ? "Replay question" : "Retry audio"}
        </Button>
      )}

      {audioNotice && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Volume2Icon className="size-3.5 shrink-0" /> {audioNotice}
        </p>
      )}

      {messages.length === 0 && (
        <Button onClick={handleBegin} disabled={loading} size="lg" className="self-start">
          {loading ? (
            <>
              <Loader2Icon className="animate-spin" /> Starting…
            </>
          ) : (
            "Begin interview"
          )}
        </Button>
      )}

      {status === "completed" && messages.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            That&apos;s the end of this mock interview — thanks for practising.
          </p>
          <Button size="sm" className="self-start" render={<Link href={`/dashboard/interview/${sessionId}/results`}><BarChart3Icon /> View full results</Link>} />
        </div>
      )}

      {status === "in_progress" && messages.length > 0 && mode === "chat" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Type your answer..."
            aria-label="Your answer"
            disabled={loading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" disabled={loading || !answerText.trim()} className="self-end">
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" /> Thinking…
              </>
            ) : (
              <>
                <SendIcon /> Send
              </>
            )}
          </Button>
        </form>
      )}

      {status === "in_progress" && messages.length > 0 && mode === "voice" && (
        <div className="flex flex-col gap-2">
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {recordingState === "recording" && `Recording… ${formatElapsed(elapsedSeconds)}`}
            {recordingState === "transcribing" && "Transcribing your answer…"}
            {recordingState === "review" &&
              (recordingLimitReached
                ? "That reached the 3-minute limit for one take — review it, then send, or re-record a shorter answer."
                : "Review your answer before sending — edit anything the transcript got wrong.")}
          </p>

          {recordingState === "idle" && (
            <Button onClick={handleStartRecording} disabled={loading} className="self-start">
              <MicIcon /> Record your answer
            </Button>
          )}

          {recordingState === "recording" && (
            <Button onClick={handleStopRecording} variant="destructive" className="self-start">
              <SquareIcon /> Stop recording
            </Button>
          )}

          {recordingState === "transcribing" && (
            <Button disabled className="self-start">
              <Loader2Icon className="animate-spin" /> Transcribing…
            </Button>
          )}

          {recordingState === "review" && (
            <div className="flex flex-col gap-2">
              <Textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                rows={4}
                maxLength={4000}
                aria-label="Edit your transcribed answer"
                disabled={loading}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleDiscardRecording} disabled={loading}>
                  <RotateCcwIcon /> Re-record
                </Button>
                <Button type="button" onClick={handleSendVoiceAnswer} disabled={loading || !draftText.trim()}>
                  {loading ? (
                    <>
                      <Loader2Icon className="animate-spin" /> Thinking…
                    </>
                  ) : (
                    <>
                      <SendIcon /> Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
          {quotaExceeded && voiceTopupsAllowed && (
            <BillingActionButton
              action={purchaseVoiceTopup.bind(null, `/dashboard/interview/${sessionId}`)}
              label={`Buy ${VOICE_TOPUP_CREDITS} more voice interviews`}
              pendingLabel="Starting checkout…"
            />
          )}
          {quotaExceeded && !voiceTopupsAllowed && (
            <p className="text-xs text-muted-foreground">
              <Link href="/pricing" className="underline">
                Upgrade to Elite
              </Link>{" "}
              for more voice interviews this month.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
