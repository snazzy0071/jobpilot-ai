"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { approveQueueItem, confirmApplied, dismissQueueItem, findMatchingJobs, processDueQueue, setAutoApplyPaused } from "@/lib/auto-apply/actions";
import { REASON_LABELS } from "@/lib/auto-apply/eligibility";
import { QUEUE_STATUS_LABELS, type QueueItem } from "@/lib/auto-apply/types";

type Doc = { id: string; label: string };

const selectClass = "h-8 rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function useAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  function run(fn: () => Promise<{ error: string } | { ok: true }>, success: (result: Record<string, unknown>) => string) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setMessage("error" in result ? { kind: "error", text: result.error } : { kind: "ok", text: success(result as Record<string, unknown>) });
    });
  }
  return { pending, message, run };
}

function Message({ message }: { message: { kind: "ok" | "error"; text: string } | null }) {
  return (
    <p role={message?.kind === "error" ? "alert" : "status"} aria-live="polite" className={message?.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      {message?.text}
    </p>
  );
}

function Meta({ item }: { item: QueueItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {item.location && <span>{item.location}</span>}
      {item.matchScore !== null && <span>Match {item.matchScore}%</span>}
      {item.sponsorStatus === "confirmed_sponsor" && <Badge variant="secondary">Licensed sponsor</Badge>}
    </div>
  );
}

function PendingRow({ item, cvs, coverLetters, paused }: { item: QueueItem; cvs: Doc[]; coverLetters: Doc[]; paused: boolean }) {
  const { pending, message, run } = useAction();
  const [cvId, setCvId] = useState(item.cvId ?? "");
  const [letterId, setLetterId] = useState(item.coverLetterId ?? "");
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4" data-queue-item={item.id} data-status={item.status}>
      <div>
        <p className="text-sm font-medium">{item.jobTitle}</p>
        <p className="text-sm text-muted-foreground">{item.companyName}</p>
        <Meta item={item} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          CV
          <select value={cvId} onChange={(event) => setCvId(event.target.value)} className={selectClass}>
            <option value="">Choose a CV…</option>
            {cvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Cover letter
          <select value={letterId} onChange={(event) => setLetterId(event.target.value)} className={selectClass}>
            <option value="">None</option>
            {coverLetters.map((letter) => (
              <option key={letter.id} value={letter.id}>
                {letter.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" disabled={pending || paused} onClick={() => run(() => approveQueueItem({ id: item.id, cvId: cvId || null, coverLetterId: letterId || null }), () => "Approved.")}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => dismissQueueItem({ id: item.id }), () => "Skipped.")}>
          Skip
        </Button>
        <a href={item.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2">
          View the listing <ExternalLinkIcon className="size-3" aria-hidden /> <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <Message message={message} />
    </li>
  );
}

function ManualRow({ item }: { item: QueueItem }) {
  const { pending, message, run } = useAction();
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4" data-queue-item={item.id} data-status={item.status}>
      <div>
        <p className="text-sm font-medium">{item.jobTitle}</p>
        <p className="text-sm text-muted-foreground">{item.companyName}</p>
        {item.lastError && <p className="mt-1 text-xs text-muted-foreground">{item.lastError}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" render={<a href={item.applyUrl} target="_blank" rel="noopener noreferrer">Open the application <span className="sr-only">(opens in a new tab)</span></a>} />
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => confirmApplied({ id: item.id }), () => "Logged in your tracker as Applied.")}>
          I&apos;ve applied
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => dismissQueueItem({ id: item.id }), () => "Skipped.")}>
          Skip
        </Button>
      </div>
      <Message message={message} />
    </li>
  );
}

function ApprovedRow({ item }: { item: QueueItem }) {
  const { pending, message, run } = useAction();
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-4" data-queue-item={item.id} data-status={item.status}>
      <div>
        <p className="text-sm font-medium">{item.jobTitle}</p>
        <p className="text-sm text-muted-foreground">{item.companyName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {QUEUE_STATUS_LABELS[item.status]} — attempt {item.attemptCount} of {item.maxAttempts}
          {item.nextAttemptAt ? `; next try after ${new Date(item.nextAttemptAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
        {item.lastError && <p className="text-xs text-muted-foreground">Last problem: {item.lastError}</p>}
      </div>
      {item.status === "approved" && (
        <div>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => dismissQueueItem({ id: item.id }), () => "Cancelled.")}>
            Cancel
          </Button>
        </div>
      )}
      <Message message={message} />
    </li>
  );
}

function Section({ title, hint, children, count }: { title: string; hint?: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div>
        <h3 className="font-heading text-base font-semibold">
          {title} <span className="text-sm font-normal text-muted-foreground">({count})</span>
        </h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

export function AutoApplyQueuePanel({ items, cvs, coverLetters, enabled, paused }: { items: QueueItem[]; cvs: Doc[]; coverLetters: Doc[]; enabled: boolean; paused: boolean }) {
  const find = useAction();
  const process = useAction();
  const pause = useAction();

  const by = (...statuses: QueueItem["status"][]) => items.filter((item) => statuses.includes(item.status));
  const pendingReview = by("pending_review");
  const manual = by("needs_manual");
  const inFlight = by("approved", "processing");
  const applied = by("applied");
  const closed = by("skipped", "failed", "cancelled");

  return (
    <div className="flex flex-col gap-6" data-testid="auto-apply-queue">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={find.pending || !enabled || paused}
            onClick={() =>
              find.run(findMatchingJobs, (r) => {
                const skipped = Object.entries((r.skipped ?? {}) as Record<string, number>)
                  .map(([reason, n]) => `${REASON_LABELS[reason as keyof typeof REASON_LABELS] ?? reason} (${n})`)
                  .join("; ");
                return `Checked ${r.considered} jobs: added ${r.added} for review, ${r.duplicates} already handled${skipped ? `. Left out — ${skipped}` : ""}.`;
              })
            }
          >
            {find.pending ? "Searching…" : "Find matching jobs"}
          </Button>
          <Button variant="outline" disabled={process.pending || !enabled || paused || inFlight.length === 0} onClick={() => process.run(processDueQueue, (r) => `Processed ${r.processed} application${r.processed === 1 ? "" : "s"}.`)}>
            Process due retries
          </Button>
          <Button variant="outline" disabled={pause.pending || !enabled} onClick={() => pause.run(() => setAutoApplyPaused({ paused: !paused }), () => (paused ? "Resumed." : "Paused — nothing will be found or approved until you resume."))}>
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
        {!enabled && <p className="text-sm text-muted-foreground">Turn Auto-Apply on in your rules below to find jobs.</p>}
        {paused && enabled && <p className="text-sm font-medium" role="status">Auto-Apply is paused.</p>}
        <Message message={find.message} />
        <Message message={process.message} />
        <Message message={pause.message} />
        <p className="text-xs text-muted-foreground">Matches use the scores you&apos;ve already generated in the Job Feed for your chosen CV — score more jobs there to widen the search.</p>
      </Card>

      {items.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing in your queue yet.</p>}

      <Section title="Waiting for your review" hint="Nothing is applied for until you approve it." count={pendingReview.length}>
        {pendingReview.map((item) => (
          <PendingRow key={item.id} item={item} cvs={cvs} coverLetters={coverLetters} paused={paused} />
        ))}
      </Section>
      <Section title="Apply yourself" hint="These need you to apply on the employer's own site. Once you have, tell us and we'll log it in your tracker." count={manual.length}>
        {manual.map((item) => (
          <ManualRow key={item.id} item={item} />
        ))}
      </Section>
      <Section title="Approved and in progress" count={inFlight.length}>
        {inFlight.map((item) => (
          <ApprovedRow key={item.id} item={item} />
        ))}
      </Section>
      <Section title="Applied" count={applied.length}>
        {applied.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4" data-queue-item={item.id} data-status={item.status}>
            <div>
              <p className="text-sm font-medium">{item.jobTitle}</p>
              <p className="text-sm text-muted-foreground">{item.companyName}</p>
            </div>
            {item.applicationId && (
              <Link href="/dashboard/applications" className="text-sm text-primary underline underline-offset-2">
                View in tracker
              </Link>
            )}
          </li>
        ))}
      </Section>
      <Section title="Closed" count={closed.length}>
        {closed.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm" data-queue-item={item.id} data-status={item.status}>
            <span>
              {item.jobTitle} — <span className="text-muted-foreground">{item.companyName}</span>
            </span>
            <Badge variant="outline">{QUEUE_STATUS_LABELS[item.status]}</Badge>
          </li>
        ))}
      </Section>
    </div>
  );
}
