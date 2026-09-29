import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import { getActiveLicence } from "@/lib/institutions/admin/queries";
import { daysUntilExpiry, EXPIRY_WARNING_DAYS, LICENCE_STATE_LABELS } from "@/lib/institutions/licence";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "No expiry";
}

/**
 * View-only by design — institution_licences' own RLS (migration 0072)
 * grants institution admins SELECT and nothing else. Seat/plan terms
 * are what JobPilot sold this institution; changing them here would
 * let an institution grant itself more capacity for free.
 */
export default async function InstitutionAdminLicencePage() {
  const { institutionId } = await requireInstitutionAdmin();
  const licence = await getActiveLicence(institutionId);
  const expiryDays = licence ? daysUntilExpiry(licence) : null;

  return (
    <div className="flex flex-col gap-6">
      {licence ? (
        <Card variant="admin" className="gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-heading text-xl font-semibold">{licence.planName}</p>
            <Badge variant={licence.state === "active" ? "tinted" : "secondary"} data-testid="licence-state">
              {LICENCE_STATE_LABELS[licence.state]}
            </Badge>
          </div>
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold">{licence.seatCount}</p>
              <p className="text-xs text-muted-foreground">Seats included</p>
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(licence.startsAt)}</p>
              <p className="text-xs text-muted-foreground">Start date</p>
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(licence.expiresAt)}</p>
              <p className="text-xs text-muted-foreground">Renewal / expiry</p>
            </div>
          </div>
          {licence.state === "expired" && (
            <p className="text-sm text-destructive" role="status">
              This licence has expired. No new members or invites can be added and members are back on their own plans. Contact JobPilot to renew.
            </p>
          )}
          {licence.state === "scheduled" && (
            <p className="text-sm text-muted-foreground" role="status">
              This licence starts on {formatDate(licence.startsAt)}.
            </p>
          )}
          {expiryDays !== null && expiryDays <= EXPIRY_WARNING_DAYS && (
            <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
              Expires in {expiryDays} day{expiryDays === 1 ? "" : "s"} — contact JobPilot to renew before members lose the plan.
            </p>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            To change your plan or seat count, contact your JobPilot account manager.
          </p>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">Your institution has no active licence. Contact JobPilot to set one up.</Card>
      )}
    </div>
  );
}
