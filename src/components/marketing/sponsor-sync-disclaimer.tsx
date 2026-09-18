import type { SponsorSyncStatus } from "@/lib/sponsors/types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** The source-date disclaimer every result on this page needs — "data as of X, verify on gov.uk" — reads migration 0054's sponsor_sync_status view (src/lib/sponsors/queries.ts's getSponsorSyncStatus). Renders an honest "hasn't synced yet" state rather than a fabricated date if no import has ever completed. */
export function SponsorSyncDisclaimer({ status }: { status: SponsorSyncStatus | null }) {
  if (!status) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        This register hasn&apos;t synced from gov.uk yet — results may be empty.
      </p>
    );
  }

  return (
    <p className="text-center text-xs text-muted-foreground">
      Data as of {formatDate(status.sourceDate)}, from the Home Office&apos;s public register. Always verify current
      status on{" "}
      <a
        href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        gov.uk
      </a>{" "}
      before relying on it.
    </p>
  );
}
