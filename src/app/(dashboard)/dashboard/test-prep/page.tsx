import Link from "next/link";
import { ArrowRight, ClockIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyPracticeCard } from "@/components/test-prep/daily-practice-card";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { requireUser } from "@/lib/auth/session";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { formatDuration } from "@/lib/test-prep/practice/summary";
import { listActiveTestTypes, listActivePacksForType, listPracticeProgress, hasCompletedTestPrepSession, getPackQuestionCounts } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

export default async function TestPrepPage() {
  const user = await requireUser();

  const [testTypes, counts, allowed] = await Promise.all([listActiveTestTypes(), getPackQuestionCounts(), hasTestPrepAccess(user.id)]);

  if (!allowed) {
    const questionCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return <LockedTestPrep typeCount={testTypes.length} questionCount={questionCount} />;
  }

  const [progress, hasProgress, packsByType] = await Promise.all([
    listPracticeProgress(user.id),
    hasCompletedTestPrepSession(user.id),
    Promise.all(testTypes.map(async (testType) => [testType.id, await listActivePacksForType(testType.id)] as const)),
  ]);
  const progressByType = new Map(progress.map((entry) => [entry.testTypeId, entry]));
  const packsMap = new Map(packsByType);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Test Prep</h1>
          <p className="mt-1 text-muted-foreground">Original practice questions in five formats — never copyrighted test items.</p>
        </div>
        {hasProgress && (
          <Button
            variant="outline"
            render={
              <Link href="/dashboard/test-prep/progress">
                <TrendingUpIcon /> Progress
              </Link>
            }
          />
        )}
      </div>

      <DailyPracticeCard />

      {testTypes.map((testType) => {
        const packs = packsMap.get(testType.id) ?? [];
        const typeProgress = progressByType.get(testType.id);

        return (
          <section key={testType.id} id={testType.id} aria-labelledby={`type-${testType.id}`} className="flex scroll-mt-20 flex-col gap-3" data-testid="test-type">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`type-${testType.id}`} className="text-lg font-semibold">
                {testType.name}
              </h2>
              {typeProgress && (
                <p className="text-sm text-muted-foreground">
                  Best {typeProgress.bestScore ?? 0}% · {typeProgress.attemptsCount} attempt{typeProgress.attemptsCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
            {testType.description && <p className="text-sm text-muted-foreground">{testType.description}</p>}

            {packs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No packs available yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {packs.map((pack) => (
                  <Link key={pack.id} href={`/dashboard/test-prep/practice/${pack.id}`} data-testid="pack-link">
                    <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="font-medium">{pack.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>{counts.get(pack.id) ?? 0} questions</span>
                          {pack.timeLimitSeconds && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="size-3" aria-hidden="true" /> {formatDuration(pack.timeLimitSeconds)} exam
                            </span>
                          )}
                        </p>
                        {pack.sectorStyle && (
                          <Badge variant="outline" className="mt-1">
                            {pack.sectorStyle}
                          </Badge>
                        )}
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
