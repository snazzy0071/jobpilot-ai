import Link from "next/link";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { hasAutoApplyAccess, AUTO_APPLY_LOCKED_MESSAGE } from "@/lib/auto-apply/access";
import { getAutoApplySettings, listEvents, listQueue } from "@/lib/auto-apply/data";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { AutoApplySettingsForm } from "@/components/auto-apply/settings-form";
import { AutoApplyQueuePanel } from "@/components/auto-apply/queue-panel";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  consent_given: "You confirmed how Auto-Apply works",
  enabled: "Auto-Apply turned on",
  disabled: "Auto-Apply turned off",
  settings_changed: "Settings saved",
  paused: "Paused",
  resumed: "Resumed",
  search: "Searched for matching jobs",
  queued: "Added for your review",
  approved: "You approved an application",
  submitted: "Application submitted",
  handed_to_manual: "Handed to you to apply on the employer's site",
  blocked_handed_to_manual: "The site's protections stopped automation — handed to you",
  attempt_failed: "An attempt failed — will retry",
  gave_up_handed_to_manual: "Retries used up — handed to you",
  failed: "Couldn't be completed",
  applied_confirmed: "You confirmed you applied — logged in your tracker",
  tracker_log_failed: "Couldn't add to your tracker",
  duplicate_prevented: "Already applied for — removed from the queue",
  skipped: "You skipped an application",
  cancelled: "You cancelled an application",
};

export default async function AutoApplyPage() {
  const user = await requireUser();

  if (!(await hasAutoApplyAccess(user.id))) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6" data-testid="auto-apply-locked">
        <Card className="items-center gap-4 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockIcon className="size-6" aria-hidden="true" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Auto-Apply is on Premium and Elite</h1>
          <p className="max-w-md text-sm text-muted-foreground">{AUTO_APPLY_LOCKED_MESSAGE}</p>
          <p className="max-w-md text-sm text-muted-foreground">It finds jobs that fit your own rules, prepares each application, and waits for your approval before anything is sent.</p>
          <Button render={<Link href="/pricing">See plans</Link>} />
        </Card>
      </div>
    );
  }

  const [settings, queue, events, cvs, letters] = await Promise.all([getAutoApplySettings(user.id), listQueue(user.id), listEvents(user.id), listCvs(user.id), listCoverLetters(user.id)]);
  const cvOptions = cvs.filter((cv) => !cv.isArchived).map((cv) => ({ id: cv.id, label: cv.title }));
  const letterOptions = letters.map((letter) => ({ id: letter.id, label: `${letter.jobTitle} — ${letter.companyName}` }));
  const titles = new Map(queue.map((item) => [item.id, `${item.jobTitle} at ${item.companyName}`]));

  return (
    <div className="flex flex-col gap-8">
      <AutoApplyQueuePanel items={queue} cvs={cvOptions} coverLetters={letterOptions} enabled={settings.enabled} paused={settings.paused} />
      <AutoApplySettingsForm settings={settings} cvs={cvOptions} coverLetters={letterOptions} />

      <section aria-label="History" className="flex flex-col gap-3" data-testid="auto-apply-history">
        <h2 className="font-heading text-lg font-semibold">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ol className="flex flex-col divide-y rounded-lg border">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  {EVENT_LABELS[event.event] ?? event.event}
                  {event.queueId && titles.get(event.queueId) ? <span className="text-muted-foreground"> — {titles.get(event.queueId)}</span> : null}
                </span>
                <time dateTime={event.createdAt} className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
