"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, Bell, Building2, Calendar, FileText, Lock, MapPin, Pencil, Plus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationTrackerFilters } from "@/components/applications/application-tracker-filters";
import { ApplicationTableView } from "@/components/applications/application-table-view";
import { updateApplicationStatus } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/applications/types";
import type { ReminderSummary } from "@/lib/applications/reminders/queries";
import {
  DEFAULT_TRACKER_FILTERS,
  applyFilters,
  applySort,
  deadlineState,
  groupByStatus,
  localDateString,
  type StatusGroups,
  type TrackerFilterState,
  type TrackerView,
} from "@/lib/applications/view";

// Only the two states the job feed's own badge ever asserts — a snapshotted 'not_found'/null renders nothing on a card
// either: the same "never claim a definite non-sponsor" rule.
const SPONSOR_BADGE_LABEL: Partial<Record<string, string>> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
};

const DEADLINE_CLASS = { overdue: "font-medium text-destructive", soon: "font-medium text-amber-700 dark:text-amber-400", later: "text-muted-foreground", none: "" } as const;

function formatDay(iso: string): string {
  // Dates arrive as YYYY-MM-DD (no time zone): format them as that calendar day, not as midnight UTC.
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

export type TrackerLinkOptions = {
  cvs: { id: string; title: string }[];
  coverLetters: { id: string; companyName: string; jobTitle: string }[];
};

function KanbanCard({
  application,
  today,
  cvTitle,
  coverLetterLabel,
  reminders,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  application: Application;
  today: string;
  cvTitle: string | null;
  coverLetterLabel: string | null;
  reminders: ReminderSummary | undefined;
  dragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (status: ApplicationStatus) => void;
}) {
  const sponsorLabel = application.sponsorStatus ? SPONSOR_BADGE_LABEL[application.sponsorStatus] : undefined;
  const state = deadlineState(application, today);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-testid="application-card"
      data-application-id={application.id}
      className={`cursor-grab gap-2 p-3 transition-opacity active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{application.jobTitle}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3 shrink-0" aria-hidden="true" />
            <span className="break-words">{application.companyName}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${application.jobTitle} at ${application.companyName}`}
          render={<Link href={`/dashboard/applications/${application.id}/edit`} />}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>

      {(application.location || application.salary) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {application.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" /> {application.location}
            </span>
          )}
          {application.salary && (
            <span className="flex items-center gap-1">
              <Wallet className="size-3" aria-hidden="true" /> {application.salary}
            </span>
          )}
        </p>
      )}

      {(sponsorLabel || application.matchScore !== null || application.frozenAt) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sponsorLabel && (
            <Badge variant={application.sponsorStatus === "confirmed_sponsor" ? "tinted" : "outline"} className="h-4 text-[10px]">
              {sponsorLabel}
            </Badge>
          )}
          {application.matchScore !== null && (
            <Badge variant="secondary" className="h-4 text-[10px]">
              Match {application.matchScore}/100
            </Badge>
          )}
          {application.frozenAt && (
            <span title="Sponsor state, match score and the submitted CV are frozen">
              <Lock className="size-3 text-muted-foreground" role="img" aria-label="Frozen since first moved to Applied" />
            </span>
          )}
        </div>
      )}

      {(cvTitle || coverLetterLabel) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {cvTitle && (
            <span className="flex items-center gap-1">
              <FileText className="size-3" aria-hidden="true" /> CV: {cvTitle}
            </span>
          )}
          {coverLetterLabel && <span>Letter: {coverLetterLabel}</span>}
        </p>
      )}

      {(application.deadline || reminders) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {application.deadline && (
            <span className={`flex items-center gap-1 ${DEADLINE_CLASS[state]}`}>
              <Calendar className="size-3" aria-hidden="true" />
              {state === "overdue" ? "Overdue · " : ""}
              {formatDay(application.deadline)}
            </span>
          )}
          {reminders && (
            <span className={`flex items-center gap-1 ${reminders.overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}>
              <Bell className="size-3" aria-hidden="true" />
              {reminders.overdue > 0 ? `${reminders.overdue} due` : `${reminders.open} reminder${reminders.open === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
      )}

      {/* Native drag/drop has no touch support in any mobile browser, so this select is the real way to move a card on
          a phone — and how a keyboard-only user moves one, since a draggable div isn't operable without a mouse. */}
      <Select items={APPLICATION_STATUS_LABELS} value={application.status} onValueChange={(value) => value && onMove(value as ApplicationStatus)}>
        <SelectTrigger size="sm" className="w-full text-xs" aria-label={`Move ${application.jobTitle} to a different status`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {APPLICATION_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {APPLICATION_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
}

function KanbanView({
  groups,
  draggingId,
  overStatus,
  today,
  links,
  reminders,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
}: {
  groups: StatusGroups;
  draggingId: string | null;
  overStatus: ApplicationStatus | null;
  today: string;
  links: TrackerLinkOptions;
  reminders: Record<string, ReminderSummary>;
  onDragStart: (id: string) => (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (status: ApplicationStatus) => (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (status: ApplicationStatus) => (event: React.DragEvent<HTMLDivElement>) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const cvTitleById = new Map(links.cvs.map((cv) => [cv.id, cv.title]));
  const letterById = new Map(links.coverLetters.map((letter) => [letter.id, `${letter.companyName}`]));

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      {APPLICATION_STATUSES.map((status) => (
        <section
          key={status}
          aria-label={`${APPLICATION_STATUS_LABELS[status]} column`}
          data-testid={`column-${status}`}
          onDragOver={onDragOver(status)}
          onDrop={onDrop(status)}
          className={`flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-xl border p-3 transition-colors ${overStatus === status && draggingId ? "border-primary bg-primary/5" : "bg-muted/30"}`}
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{APPLICATION_STATUS_LABELS[status]}</h2>
            <Badge variant="outline">{groups[status].length}</Badge>
          </div>

          <div className="flex min-h-16 flex-col gap-2">
            {groups[status].length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No applications</p>
            ) : (
              groups[status].map((application) => (
                <KanbanCard
                  key={application.id}
                  application={application}
                  today={today}
                  cvTitle={application.cvId ? (cvTitleById.get(application.cvId) ?? null) : null}
                  coverLetterLabel={application.coverLetterId ? (letterById.get(application.coverLetterId) ?? null) : null}
                  reminders={reminders[application.id]}
                  dragging={draggingId === application.id}
                  onDragStart={onDragStart(application.id)}
                  onDragEnd={onDragEnd}
                  onMove={(newStatus) => onMove(application.id, newStatus)}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The Tracker's single source of truth: one `applications` array and one TrackerFilterState, rendered as either a
 * kanban board or a table. Switching the view never re-fetches or re-filters anything; it changes which of two
 * renderers reads the same already-computed list (src/lib/applications/view.ts).
 *
 * Drag/drop is the native HTML5 Drag and Drop API — no dependency, and no touch support in any mobile browser. Every
 * card's own status select (and the table's per-row one) performs the identical move, so touch, keyboard and assistive
 * technology users have an equally real way to do it.
 *
 * Optimistic UI over a narrow server call: a move updates local state at once, then calls updateApplicationStatus({id,
 * status}), which touches only that (plus the first-Applied freeze). A failed call reverts the move and says why. The
 * freeze happens on the server, so the lock icon and the frozen sponsor/score appear when the server answers, not
 * before — the move is applied for real and the page refreshed data comes back with it.
 */
export function ApplicationTrackerBoard({
  applications,
  cvs,
  coverLetters,
  reminders,
}: {
  applications: Application[];
  cvs: TrackerLinkOptions["cvs"];
  coverLetters: TrackerLinkOptions["coverLetters"];
  reminders: Record<string, ReminderSummary>;
}) {
  const [items, setItems] = useState(applications);
  // Re-sync when the server hands this page a fresh array (React's "adjust state during render" pattern, no effect).
  const [syncedApplications, setSyncedApplications] = useState(applications);
  if (applications !== syncedApplications) {
    setSyncedApplications(applications);
    setItems(applications);
  }

  const [filters, setFilters] = useState<TrackerFilterState>(DEFAULT_TRACKER_FILTERS);
  const [view, setView] = useState<TrackerView>("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => localDateString());

  const sorted = applySort(applyFilters(items, filters, today), filters.sort);
  const groups = groupByStatus(sorted);

  function setLocally(id: string, patch: Partial<Application>) {
    setItems((prev) => prev.map((application) => (application.id === id ? { ...application, ...patch } : application)));
  }

  async function moveCard(id: string, toStatus: ApplicationStatus) {
    const current = items.find((application) => application.id === id);
    if (!current || current.status === toStatus) return;

    setError(null);
    setLocally(id, { status: toStatus });

    const result = await updateApplicationStatus({ id, status: toStatus });
    if ("error" in result) {
      setLocally(id, { status: current.status });
      setError(result.error);
      return;
    }
    // The server may have frozen the snapshot and stamped the applied date; take what it actually stored.
    setLocally(id, result.application);
  }

  function handleDrop(status: ApplicationStatus) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      setDraggingId(null);
      setOverStatus(null);
      if (id) void moveCard(id, status);
    };
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((application) => application.id !== id));
  }

  if (items.length === 0) {
    return (
      <Card className="items-center gap-3 p-10 text-center" data-testid="tracker-empty">
        <p className="font-medium">Nothing tracked yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Add a role you&apos;re planning to apply for or have already applied to, or use “Add to tracker” on any job in the job feed.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href="/dashboard/applications/new" />}>
            <Plus className="size-4" /> Add application
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/jobs" />}>
            Browse the job feed
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ApplicationTrackerFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => setFilters(DEFAULT_TRACKER_FILTERS)}
        cvs={cvs}
        coverLetters={coverLetters}
        view={view}
        onViewChange={setView}
        resultCount={sorted.length}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}

      {view === "kanban" ? (
        <KanbanView
          groups={groups}
          draggingId={draggingId}
          overStatus={overStatus}
          today={today}
          links={{ cvs, coverLetters }}
          reminders={reminders}
          onDragStart={(id) => (event) => {
            event.dataTransfer.setData("text/plain", id);
            event.dataTransfer.effectAllowed = "move";
            setDraggingId(id);
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setOverStatus(null);
          }}
          onDragOver={(status) => (event) => {
            event.preventDefault();
            if (overStatus !== status) setOverStatus(status);
          }}
          onDrop={handleDrop}
          onMove={(id, status) => void moveCard(id, status)}
        />
      ) : (
        <ApplicationTableView
          applications={sorted}
          cvs={cvs}
          coverLetters={coverLetters}
          reminders={reminders}
          today={today}
          onStatusChange={(id, status) => void moveCard(id, status)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
