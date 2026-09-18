import Link from "next/link";
import { PlusIcon, TrendingUpIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listInterviewSessions } from "@/lib/interviews/queries";
import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_DIFFICULTY_LABELS,
  type InterviewStatus,
} from "@/lib/interviews/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const STATUS_BADGE_VARIANT: Record<InterviewStatus, "secondary" | "outline"> = {
  in_progress: "secondary",
  completed: "outline",
  abandoned: "outline",
};

const STATUS_LABEL: Record<InterviewStatus, string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

export default async function InterviewSessionsPage() {
  const user = await requireUser();
  const sessions = await listInterviewSessions(user.id);
  const hasCompletedSession = sessions.some((session) => session.status === "completed");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Interview Coach</h1>
          <p className="mt-1 text-muted-foreground">Practice competency-based interviews and review your questions.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasCompletedSession && (
            <Button
              variant="outline"
              render={
                <Link href="/dashboard/interview/progress">
                  <TrendingUpIcon /> Progress
                </Link>
              }
            />
          )}
          <Button render={<Link href="/dashboard/interview/new"><PlusIcon /> New session</Link>} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">You haven&apos;t started a mock interview yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/dashboard/interview/${session.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{session.role}</CardTitle>
                    <Badge variant={STATUS_BADGE_VARIANT[session.status]} className="text-xs font-normal">
                      {STATUS_LABEL[session.status]}
                    </Badge>
                  </div>
                  <CardDescription>{session.company ?? "General practice"}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {INTERVIEW_MODE_LABELS[session.mode]} · {INTERVIEW_DIFFICULTY_LABELS[session.difficulty]} ·{" "}
                    {session.questionCount} questions
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
