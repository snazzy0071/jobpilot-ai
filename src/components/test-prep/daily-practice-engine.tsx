"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, CheckCircle2Icon, FlameIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuizSession } from "@/components/test-prep/quiz-session";
import { startDailyPractice } from "@/lib/test-prep/daily/actions";
import type { StartedSession } from "@/lib/test-prep/practice/types";

/**
 * The daily five. One question from each test format, chosen by the server from what you haven't mastered, once per local
 * calendar day. Starting again after leaving part-way resumes the same five with your earlier answers.
 */
export function DailyPracticeEngine() {
  const [session, setSession] = useState<(StartedSession & { resumed: boolean }) | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  async function start() {
    setStarting(true);
    setError(null);
    const response = await startDailyPractice({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setStarting(false);
    if ("error" in response) {
      setError(response.error);
      return;
    }
    if ("alreadyCompletedToday" in response) {
      setAlreadyDone(true);
      return;
    }
    setSession(response);
  }

  if (session) return <QuizSession session={session} title="Daily five" isDaily />;

  if (alreadyDone) {
    return (
      <Card className="items-center gap-3 p-10 text-center" data-testid="daily-done">
        <CheckCircle2Icon className="size-8 text-primary" aria-hidden="true" />
        <h1 className="font-heading text-xl font-semibold">You&apos;ve done today&apos;s five</h1>
        <p className="max-w-md text-sm text-muted-foreground">Come back tomorrow to keep your streak going — or practise a full pack now.</p>
        <Button render={<Link href="/dashboard/test-prep">Back to Test Prep</Link>} />
      </Card>
    );
  }

  return (
    <Card className="items-center gap-4 p-10 text-center" data-testid="daily-start">
      <FlameIcon className="size-8 text-primary" aria-hidden="true" />
      <h1 className="font-heading text-xl font-semibold">Today&apos;s five</h1>
      <p className="max-w-md text-sm text-muted-foreground">One question from each of the five test formats, picked from the ones you haven&apos;t seen or got wrong. About five minutes.</p>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
      <Button onClick={() => void start()} disabled={starting}>
        {starting ? (
          <>
            <Loader2Icon className="size-4 animate-spin" /> Starting…
          </>
        ) : (
          "Start today's five"
        )}
      </Button>
    </Card>
  );
}
