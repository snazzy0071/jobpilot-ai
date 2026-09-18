export type AdminJobSourceHealth = {
  sourceId: string;
  sourceName: string;
  isActive: boolean;
  activeJobCount: number;
  lastCompletedAt: string | null;
  fetchedCount: number | null;
  createdCount: number | null;
  updatedCount: number | null;
};

export type AdminJobImportRun = {
  id: string;
  runType: string;
  sourceName: string | null;
  status: string;
  fetchedCount: number | null;
  createdCount: number | null;
  updatedCount: number | null;
  duplicateCount: number | null;
  deactivatedCount: number | null;
  prunedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AdminJobFeedHealth = {
  totalActiveJobs: number;
  sources: AdminJobSourceHealth[];
  recentRuns: AdminJobImportRun[];
};
