import Link from "next/link";
import { ArrowRight, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyPracticeCard } from "@/components/test-prep/daily-practice-card";
import { requireUser } from "@/lib/auth/session";
import { listActiveTestTypes, listActivePacksForType, listPracticeProgress, hasCompletedTestPrepSession } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

export default async function TestPrepPage() {
  const user = await requireUser();

  const [testTypes, progress, hasProgress] = await Promise.all([
    listActiveTestTypes(),
    listPracticeProgress(user.id),
    hasCompletedTestPrepSession(user.id),
  ]);
  const progressByType = new Map(progress.map((entry) => [entry.testTypeId, entry]));
  const packsByType = await Promise.all(testTypes.map(async (testType) => [testType.id, await listActivePacksForType(testType.id)] as const));
  const packsMap = new Map(packsByType);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Test Prep</h1>
          <p className="mt-1 text-muted-foreground">Original practice questions — never copyrighted test items.</p>
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
          <div key={testType.id} id={testType.id} className="flex flex-col gap-3 scroll-mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{testType.name}</h2>
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
                  <Link key={pack.id} href={`/dashboard/test-prep/practice/${pack.id}`}>
                    <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
                      <div>
                        <p className="font-medium">{pack.name}</p>
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
          </div>
        );
      })}
    </div>
  );
}
