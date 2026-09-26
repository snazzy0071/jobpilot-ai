"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, Loader2Icon, PlayIcon, TimerIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { QuizSession } from "@/components/test-prep/quiz-session";
import { startTestSession } from "@/lib/test-prep/practice/actions";
import { formatDuration } from "@/lib/test-prep/practice/summary";
import type { StartedSession } from "@/lib/test-prep/practice/types";
import type { QuestionPack } from "@/lib/test-prep/types";

const CHOICE_CLASS =
  "flex flex-col items-center gap-1 rounded-xl border p-4 text-center transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

/**
 * A pack's start screen: choose Practice (untimed, feedback after every answer) or a Timed exam (the pack's own time
 * limit, results and explanations only at the end). Nothing is started until you choose — the session, its questions and
 * (for timed) its deadline are created by the server at that moment.
 */
export function PackStart({ pack, questionCount }: { pack: QuestionPack; questionCount: number }) {
  const [session, setSession] = useState<StartedSession | null>(null);
  const [starting, setStarting] = useState<"practice" | "timed" | null>(null);
  const [error, setError] = useState<{ message: string; locked: boolean } | null>(null);

  async function start(mode: "practice" | "timed") {
    setStarting(mode);
    setError(null);
    const response = await startTestSession({ questionPackId: pack.id, mode });
    setStarting(null);
    if ("error" in response) {
      setError({ message: response.error, locked: !!response.locked });
      return;
    }
    setSession(response);
  }

  if (session) return <QuizSession session={session} title={pack.name} practiceAgainHref={`/dashboard/test-prep/practice/${pack.id}`} />;

  return (
    <Card className="items-center gap-4 p-8 text-center" data-testid="pack-start">
      <h1 className="font-heading text-xl font-semibold">{pack.name}</h1>
      {pack.description && <p className="max-w-md text-sm text-muted-foreground">{pack.description}</p>}
      <p className="text-sm text-muted-foreground">
        {questionCount} question{questionCount === 1 ? "" : "s"}
        {pack.timeLimitSeconds ? ` · exam time limit ${formatDuration(pack.timeLimitSeconds)}` : ""}
      </p>

      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void start("practice")} disabled={starting !== null} className={CHOICE_CLASS}>
          {starting === "practice" ? <Loader2Icon className="size-5 animate-spin text-primary" /> : <PlayIcon className="size-5 text-primary" aria-hidden="true" />}
          <span className="font-medium">Practice</span>
          <span className="text-xs text-muted-foreground">No clock. See whether each answer is right, and why, straight away.</span>
        </button>
        {pack.timeLimitSeconds ? (
          <button type="button" onClick={() => void start("timed")} disabled={starting !== null} className={CHOICE_CLASS}>
            {starting === "timed" ? <Loader2Icon className="size-5 animate-spin text-primary" /> : <TimerIcon className="size-5 text-primary" aria-hidden="true" />}
            <span className="font-medium">Timed exam</span>
            <span className="text-xs text-muted-foreground">{formatDuration(pack.timeLimitSeconds)} on the clock. Answers and explanations only when you finish.</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">This pack has no time limit, so there is no timed exam.</div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error.message}
          {error.locked && (
            <Link href="/pricing" className="underline">
              See plans
            </Link>
          )}
        </p>
      )}
    </Card>
  );
}
