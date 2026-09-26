export type AdminSponsorImport = {
  id: string;
  sourceDate: string;
  status: string;
  sponsorCount: number | null;
  routeCount: number | null;
  addedCount: number | null;
  reactivatedCount: number | null;
  deactivatedCount: number | null;
  routesRemovedCount: number | null;
  aliasesRemovedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

/** ok = the last completed sync is recent; stale = it isn't; failed = the newest run failed; running = a run is in progress; never = no sync has ever completed. */
export type AdminSponsorSyncState = "ok" | "stale" | "failed" | "running" | "never";

export type AdminSponsorChange = {
  changeType: "added" | "reactivated" | "deactivated";
  companyName: string;
  sponsorId: string;
  importId: string;
  createdAt: string;
};

export type AdminSponsorSyncOverview = {
  state: AdminSponsorSyncState;
  /** How old the last completed sync may be before it's called stale. */
  staleAfterHours: number;
  activeSponsorCount: number;
  inactiveSponsorCount: number;
  totalSponsorCount: number;
  lastCompletedAt: string | null;
  /** The Home Office register's own publication date, from the last completed sync. */
  lastSourceDate: string | null;
  imports: AdminSponsorImport[];
  /** Sponsors that were reactivated or dropped off in the most recent completed sync (the full "added" list is the entire register on a first sync, so it's counted, not listed). */
  latestChanges: AdminSponsorChange[];
  /** Whether "Run sync now" can dispatch the daily GitHub Actions workflow from here (needs the repo + token env vars). */
  canTriggerSync: boolean;
};
