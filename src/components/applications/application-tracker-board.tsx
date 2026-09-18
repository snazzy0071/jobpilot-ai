"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, Building2, Calendar, Lock, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ApplicationTrackerFilters,
  DEFAULT_TRACKER_FILTERS,
  type TrackerFilterState,
  type TrackerView,
} from "@/components/applications/application-tracker-filters";
import { ApplicationTableView } from "@/components/applications/application-table-view";
import { updateApplicationStatus } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/applications/types";

// Only the two states src/components/jobs/job-sponsor-badge.tsx ever
// asserts — a snapshotted 'not_found'/null renders nothing here either,
// same "never claim a definite non-sponsor" rule.
const SPONSOR_BADGE_LABEL: Partial<Record<string, string>> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
};

function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

type StatusGroups = Record<ApplicationStatus, Application[]>;

function groupByStatus(applications: Application[]): StatusGroups {
  const groups = APPLICATION_STATUSES.reduce((acc, status) => {
    acc[status] = [];
    return acc;
  }, {} as StatusGroups);
  for (const application of applications) {
    groups[application.status].push(application);
  }
  return groups;
}

function applyFilters(applications: Application[], filters: TrackerFilterState): Application[] {
  const term = filters.search.trim().toLowerCase();
  return applications.filter((application) => {
    if (term && !`${application.companyName} ${application.jobTitle}`.toLowerCase().includes(term)) return false;
    if (filters.status !== "all" && application.status !== filters.status) return false;
    if (filters.sponsor !== "all") {
      const matches = filters.sponsor === "none" ? application.sponsorStatus === null : application.sponsorStatus === filters.sponsor;
      if (!matches) return false;
    }
    if (filters.cvId !== "all") {
      const matches = filters.cvId === "none" ? application.cvId === null : application.cvId === filters.cvId;
      if (!matches) return false;
    }
    return true;
  });
}

function applySort(applications: Application[], sort: TrackerFilterState["sort"]): Application[] {
  const sorted = [...applications];
  switch (sort) {
    case "deadline_asc":
      return sorted.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
    case "company_az":
      return sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
    case "match_desc":
      return sorted.sort((a, b) => {
        if (a.matchScore === null) return 1;
        if (b.matchScore === null) return -1;
        return b.matchScore - a.matchScore;
      });
    case "status":
      return sorted.sort((a, b) => APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status));
    case "updated_desc":
    default:
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

function KanbanCard({
  application,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  application: Application;
  dragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (status: ApplicationStatus) => void;
}) {
  const sponsorLabel = application.sponsorStatus ? SPONSOR_BADGE_LABEL[application.sponsorStatus] : undefined;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab gap-2 p-3 transition-opacity active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{application.jobTitle}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Building2 className="size-3 shrink-0" />
            {application.companyName}
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
            <span title="Sponsor state, match score and submitted CV version are frozen">
              <Lock className="size-3 text-muted-foreground" role="img" aria-label="Frozen since first moved to Applied" />
            </span>
          )}
        </div>
      )}

      {application.deadline && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          {formatDeadline(application.deadline)}
        </p>
      )}

      {/* Native drag/drop has no touch support at all, so this select
          is the real way to move a card on mobile — not a decorative
          fallback. It's also how a keyboard-only user moves a card,
          since a plain draggable div isn't operable without a mouse. */}
      <Select value={application.status} onValueChange={(value) => value && onMove(value as ApplicationStatus)}>
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
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
}: {
  groups: StatusGroups;
  draggingId: string | null;
  onDragStart: (id: string) => (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDrop: (status: ApplicationStatus) => (event: React.DragEvent<HTMLDivElement>) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      {APPLICATION_STATUSES.map((status) => (
        <div
          key={status}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop(status)}
          className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-xl border bg-muted/30 p-3"
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
                  dragging={draggingId === application.id}
                  onDragStart={onDragStart(application.id)}
                  onDragEnd={onDragEnd}
                  onMove={(newStatus) => onMove(application.id, newStatus)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The Tracker's single source of truth: one `applications` array, one
 * `TrackerFilterState`, rendered as either a kanban board or a table —
 * that shared state (not two independent components each keeping their
 * own copy) is what "keep Kanban/Table state consistent" actually
 * means here. Switching the `view` toggle never re-fetches or re-
 * filters anything; it just changes which of two renderers reads the
 * same already-computed `sorted` array.
 *
 * Drag/drop (kanban) is the native HTML5 Drag and Drop API — no new
 * dependency, but with a real, honest limitation: no touch support in
 * any mobile browser. Every card's own status `Select` (and the
 * table's per-row status `Select`) perform the identical
 * `updateApplicationStatus` move, so touch/keyboard/assistive-tech
 * users get an equally real way to do the same thing, not a degraded
 * one — that's what "responsive" means for this feature, not just a
 * layout that resizes.
 *
 * Optimistic UI, backed by a safe, narrow DB update: a move updates
 * local state immediately, then calls the dedicated
 * `updateApplicationStatus({id, status})` — never the full
 * `updateApplication` action — which only ever touches `id`/`status`,
 * scoped to the requesting user; `application_status_history` is
 * written by that table's own trigger (migration 0063), not by this
 * code. A failed call reverts the move and surfaces a real error.
 */
export function ApplicationTrackerBoard({ applications, cvs }: { applications: Application[]; cvs: { id: string; title: string }[] }) {
  const [items, setItems] = useState(applications);
  // Adjusted during render, not an effect (React's own recommended
  // "resetting state when a prop changes" pattern, same fix
  // application-kanban-board.tsx's first draft needed) — re-syncs
  // whenever the server gives this page a fresh `applications` array,
  // without an extra render or a flash.
  const [syncedApplications, setSyncedApplications] = useState(applications);
  if (applications !== syncedApplications) {
    setSyncedApplications(applications);
    setItems(applications);
  }

  const [filters, setFilters] = useState<TrackerFilterState>(DEFAULT_TRACKER_FILTERS);
  const [view, setView] = useState<TrackerView>("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = applyFilters(items, filters);
  const sorted = applySort(filtered, filters.sort);
  const groups = groupByStatus(sorted);

  function findStatus(id: string): ApplicationStatus | null {
    return items.find((application) => application.id === id)?.status ?? null;
  }

  function setStatusLocally(id: string, status: ApplicationStatus) {
    setItems((prev) => prev.map((application) => (application.id === id ? { ...application, status } : application)));
  }

  async function moveCard(id: string, toStatus: ApplicationStatus) {
    const fromStatus = findStatus(id);
    if (!fromStatus || fromStatus === toStatus) return;

    setError(null);
    setStatusLocally(id, toStatus);

    const result = await updateApplicationStatus({ id, status: toStatus });
    if ("error" in result) {
      setStatusLocally(id, fromStatus);
      setError(result.error);
    }
  }

  function handleDrop(status: ApplicationStatus) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      setDraggingId(null);
      if (id) void moveCard(id, status);
    };
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((application) => application.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <ApplicationTrackerFilters
        filters={filters}
        onFiltersChange={setFilters}
        cvs={cvs}
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
          onDragStart={(id) => (event) => {
            event.dataTransfer.setData("text/plain", id);
            event.dataTransfer.effectAllowed = "move";
            setDraggingId(id);
          }}
          onDragEnd={() => setDraggingId(null)}
          onDrop={handleDrop}
          onMove={(id, status) => void moveCard(id, status)}
        />
      ) : (
        <ApplicationTableView
          applications={sorted}
          cvs={cvs}
          onStatusChange={(id, status) => void moveCard(id, status)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
