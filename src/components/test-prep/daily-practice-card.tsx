"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, FlameIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyPracticeStatus } from "@/lib/test-prep/daily/actions";
import type { DailyPracticeStatus } from "@/lib/test-prep/daily/types";

function DayDot({ day, isToday }: { day: DailyPracticeStatus["last14Days"][number]; isToday: boolean }) {
  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const title = day.completed
    ? `${label} — completed${day.totalQuestions !== null ? ` (${day.correctCount}/${day.totalQuestions})` : ""}`
    : `${label} — not completed`;
  return (
    <div
      title={title}
      className={`size-4 rounded-sm ${day.completed ? "bg-primary" : "bg-muted"} ${
        isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""
      }`}
    />
  );
}

/**
 * The dashboard-facing half of daily practice: streak, a 14-day
 * completion strip, and whether today is already done. It has to be a
 * client component and fetch its own data on mount rather than being
 * server-rendered with the rest of the page — the streak/"completed
 * today" calculation is timezone-safe precisely because it's computed
 * from the browser's own IANA zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
 * which a server component has no way to know.
 */
export function DailyPracticeCard() {
  const [status, setStatus] = useState<DailyPracticeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await getDailyPracticeStatus({ timezone });
      if (cancelled) return;
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setStatus(response);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Card className="p-4 text-sm text-destructive">{error}</Card>;
  }

  if (!status) {
    return <Skeleton className="h-[104px] w-full" />;
  }

  const todayDate = status.last14Days[status.last14Days.length - 1]?.date;

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlameIcon className={`size-5 ${status.currentStreak > 0 ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className="font-heading text-lg leading-tight font-semibold">
              {status.currentStreak > 0 ? `${status.currentStreak}-day streak` : "Start your streak"}
            </p>
            <p className="text-xs text-muted-foreground">5 quick questions a day</p>
          </div>
        </div>
        {status.completedToday ? (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2Icon className="size-3.5" /> Completed today
          </Badge>
        ) : (
          <Button size="sm" render={<Link href="/dashboard/test-prep/daily">Start today&apos;s practice</Link>} />
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
