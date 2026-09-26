import Link from "next/link";
import { LockIcon, TimerIcon, FlameIcon, LineChartIcon, ListChecksIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TEST_PREP_LOCKED_MESSAGE } from "@/lib/test-prep/access";

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ListChecksIcon, title: "Five formats", text: "Critical thinking, situational judgement, numerical, verbal and diagrammatic reasoning." },
  { icon: TimerIcon, title: "Timed exams", text: "Sit a pack against the clock, with answers and explanations once you finish." },
  { icon: FlameIcon, title: "Daily five", text: "Five mixed questions a day, chosen from what you haven't mastered, with a streak." },
  { icon: LineChartIcon, title: "Weak-area analysis", text: "Accuracy by topic, what's improving, and focused practice where you're weakest." },
];

/**
 * What a plan without Test Prep sees. The server refuses every practice action regardless (src/lib/test-prep/access.ts);
 * this is the honest explanation, with the real size of the catalogue read from the database.
 */
export function LockedTestPrep({ typeCount, questionCount }: { typeCount: number; questionCount: number }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6" data-testid="test-prep-locked">
      <Card className="items-center gap-4 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockIcon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Test Prep is on Premium and Elite</h1>
        <p className="max-w-md text-sm text-muted-foreground">{TEST_PREP_LOCKED_MESSAGE}</p>
        {questionCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {questionCount.toLocaleString("en-GB")} original practice questions across {typeCount} test formats are ready for you.
          </p>
        )}
        <Button render={<Link href="/pricing">See plans</Link>} />
      </Card>
      <ul className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-lg border p-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
