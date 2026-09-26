"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, Loader2Icon, TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuizSession } from "@/components/test-prep/quiz-session";
import { startFocusedPractice } from "@/lib/test-prep/practice/actions";
import type { StartedSession } from "@/lib/test-prep/practice/types";

/** Focused practice on one weak topic: up to ten questions on it, never-seen and last-missed first. */
export function FocusPracticeStart({ testTypeId, testTypeName, subtype }: { testTypeId: string; testTypeName: string; subtype: string }) {
  const [session, setSession] = useState<StartedSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    const response = await startFocusedPractice({ testTypeId, subtype });
    setStarting(false);
    if ("error" in response) {
      setError(response.error);
      return;
    }
    setSession(response);
  }

  if (session) {
    return <QuizSession session={session} title={`Focus: ${subtype}`} practiceAgainHref={`/dashboard/test-prep/focus?type=${testTypeId}&subtype=${encodeURIComponent(subtype)}`} />;
  }

  return (
    <Card className="items-center gap-4 p-10 text-center" data-testid="focus-start">
      <TargetIcon className="size-8 text-primary" aria-hidden="true" />
      <h1 className="font-heading text-xl font-semibold">Focus on {subtype}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Up to ten {testTypeName.toLowerCase()} questions on this topic, starting with the ones you haven&apos;t seen or last got wrong.
      </p>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void start()} disabled={starting}>
          {starting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Starting…
            </>
          ) : (
            "Start focused practice"
          )}
        </Button>
        <Button variant="outline" render={<Link href="/dashboard/test-prep/progress">Back</Link>} />
      </div>
    </Card>
  );
}
