"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, FlameIcon, LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyPracticeStatus } from "@/lib/test-prep/daily/actions";
import type { DailyPracticeStatus } from "@/lib/test-prep/daily/types";

function DayDot({ day, isToday }: { day: DailyPracticeStatus["last14Days"][number]; isToday: boolean }) {
  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const title = day.completed ? `${label} — completed${day.totalQuestions !== null ? ` (${day.correctCount}/${day.totalQuestions})` : ""}` : `${label} — not completed`;
  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      data-completed={day.completed}
      className={`size-4 rounded-sm ${day.completed ? "bg-primary" : "bg-muted"} ${isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
    />
  );
}

/**
 * The dashboard-facing half of the daily five: streak, longest streak, a 14-day completion strip, and whether today is
 * done. It is a client component that fetches its own data on mount because the streak is timezone-safe precisely by being
 * computed from the browser's own IANA zone, which a server component can't know. On a plan without Test Prep the server
 * answers "locked" and this shows a one-line upgrade prompt instead.
 */
export function DailyPracticeCard() {
  const [status, setStatus] = useState<DailyPracticeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await getDailyPracticeStatus({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (cancelled) return;
      if ("error" in response) {
        if ("locked" in response && response.locked) setLocked(true);
        else setError(response.error);
        return;
      }
      setStatus(response);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (locked) {
    return (
      <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4" data-testid="daily-locked">
        <div className="flex items-center gap-2 text-sm">
          <LockIcon className="size-4 text-muted-foreground" aria-hidden="true" /> The daily five and streak are part of Premium and Elite.
        </div>
        <Button size="sm" variant="outline" render={<Link href="/pricing">See plans</Link>} />
      </Card>
    );
  }

  if (error) return <Card className="p-4 text-sm text-destructive">{error}</Card>;
  if (!status) return <Skeleton className="h-[104px] w-full" />;

  const todayDate = status.last14Days[status.last14Days.length - 1]?.date;

  return (
    <Card className="gap-4 p-4" data-testid="daily-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlameIcon className={`size-5 ${status.currentStreak > 0 ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
          <div>
            <p className="font-heading text-lg leading-tight font-semibold" data-testid="daily-streak">
              {status.currentStreak > 0 ? `${status.currentStreak}-day streak` : "Start your streak"}
            </p>
            <p className="text-xs text-muted-foreground">
              5 quick questions a day
              {status.longestStreak > 0 ? ` · longest ${status.longestStreak} day${status.longestStreak === 1 ? "" : "s"}` : ""}
              {status.totalDaysCompleted > 0 ? ` · ${status.totalDaysCompleted} day${status.totalDaysCompleted === 1 ? "" : "s"} done` : ""}
            </p>
          </div>
        </div>
        {status.completedToday ? (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2Icon className="size-3.5" /> Completed today
          </Badge>
        ) : (
          <Button size="sm" render={<Link href="/dashboard/test-prep/daily">{status.inProgressToday ? "Resume today's five" : "Start today's practice"}</Link>} />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {status.last14Days.map((day) => (
          <DayDot key={day.date} day={day} isToday={day.date === todayDate} />
        ))}
      </div>
    </Card>
  );
}
