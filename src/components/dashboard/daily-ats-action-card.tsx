import Link from "next/link";
import { ScanSearchIcon, ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * reference/auth/dashboard.png's "Daily action" card — shown only when
 * it's actually true (the most-recently-edited CV has never been
 * ATS-scanned), not as permanent decoration.
 */
export function DailyAtsActionCard() {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <ScanSearchIcon className="size-4 text-primary" />
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Daily action</p>
      </div>
      <p className="font-heading text-lg font-semibold">Run an ATS scan on your CV</p>
      <p className="text-sm text-muted-foreground">
        Recruiters&apos; filters quietly reject CVs that don&apos;t match a job&apos;s keywords — a two-minute scan
        shows you what&apos;s missing before a human ever sees it.
      </p>
      <Link href="/dashboard/cvs" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
        Scan my CV <ArrowRightIcon className="size-4" />
      </Link>
    </Card>
  );
}
