export type AdminSponsorImport = {
  id: string;
  sourceDate: string;
  status: string;
  sponsorCount: number | null;
  routeCount: number | null;
  addedCount: number | null;
  reactivatedCount: number | null;
  deactivatedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AdminSponsorSyncOverview = {
  activeSponsorCount: number;
  totalSponsorCount: number;
  lastCompletedAt: string | null;
  imports: AdminSponsorImport[];
};
